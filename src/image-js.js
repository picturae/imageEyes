import ijs from '../node_modules/image-js/dist/image'
import { mathAvg } from './utilities'

const cache = new Object()
let cacheOrder = new Array()
const MAX_CACHE_SIZE = 32
let currentUrl
let currentImage
let loading

/**
 * Return the color model string
 * @returns {String} [ RGB | CMYK ]
 */
const getColorModel = function(x, y) {
    if (loading) return
    const model = currentImage.colorModel
    return model
}

/**
 * Return the values of the color and alpha channels of one point in the image
 * @param {Number} x pixel count from left of image
 * @param {Number} y pixel count from top of image
 * @returns {Array} array with values for each color channel
 *    @members {Number} value of color or alpha channel
 */
const getPixelColor = function(x, y) {
    if (loading) return
    let left = Math.round(x)
    let top = Math.round(y)
    const res = currentImage.getPixelXY(left, top)
    return res
}

/**
 * Compose an array with channel values from the average of the channels in a rectangular area
 * @param {Number} x pixel count from left of image
 * @param {Number} y pixel count from top of image
 * @param {Number} d width and height of the sample
 * @returns {Array} array with values for each channel
 *    @members {Number} average value of color or alpha channel
 */
const getDropColor = function(x, y, d) {
    if (loading) return
    let left = Math.round(x)
    let top = Math.round(y)
    let radius = Math.floor(d / 2)
    let color

    // setup sort-of multi-dimensional array
    let sample = Array(currentImage.channels)
    for (let n = 0; n < currentImage.channels; n++) {
        sample[n] = []
    }

    // traverse the drop
    for (let i = left - radius; i <= left + radius; i++) {
        for (let j = top - radius; j <= top + radius; j++) {
            color = currentImage.getPixelXY(i, j)
            if (typeof color[0] === 'number') {
                for (let n = 0; n < currentImage.channels; n++) {
                    sample[n].push(color[n])
                }
            }
        }
    }

    // find averge;
    for (let n = 0; n < currentImage.channels; n++) {
        let average = mathAvg(sample[n])
        color[n] = Math.round(average)
    }
    return color
}

/*
 * Report the size of the buffer
 * @returns {String} usage - size of the buffer with unit
 */
const memoryUsage = function() {
    let usage = 0
    for (let [url, image] of Object.entries(cache)) {
        usage += image.data.byteLength
    }
    return `${mathRoundAt(usage / 1024 / 1024, 3)} MB`
}

/*
 * Remove all but the current image from the cache
 */
const purgeCache = function() {
    cacheOrder.forEach(url => {
        if (url !== currentUrl) delete cache[url]
    })
    cacheOrder = [url]
}

/*
 * Keep cache history - put new currentUrl at the end
 * @private
 * @param {URL} url - new currentUrl
 */
const maintainCacheOrder = function(url) {
    const urlIndex = cacheOrder.indexOf(url)
    cacheOrder.splice(urlIndex, 1)
    cacheOrder.push(url)
}

/*
 * Keep size of cache within limits - remove most discarded entry
 * @private
 */
const maintainCache = function(url) {
    const removeUrl = cacheOrder.splice(0, 1)[0]
    delete cache[removeUrl]
    cacheOrder.push(url)
}

const api = {
    get image() {
        if (loading) return
        return currentImage
    },
    getColorModel: getColorModel,
    getPixelColor: getPixelColor,
    getDropColor: getDropColor,
    memoryUsage: memoryUsage,
    purgeCache: purgeCache,
}

const loader = async function(url) {
    if (loading || url === currentUrl) return api
    loading = true
    if (cache[url]) {
        maintainCacheOrder()
        currentImage = cache[url]
    } else {
        if (cacheOrder.length >= MAX_CACHE_SIZE) {
            maintainCache()
        }
        currentImage = await ijs.load(url)
        cache[url] = currentImage
    }
    loading = false
    currentUrl = url
    return api
}

export default loader
