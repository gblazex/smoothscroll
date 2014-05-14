
// SmoothScroll v1.2.1
// Licensed under the terms of the MIT license.
// Balázs Galambosi (c) 2013

/**
 * A module for middle mouse scrolling.
 */
(function (window) {

var defaultOptions = {
    middleMouse : false,
    frameRate   : 200
};

var options = defaultOptions;

var img = document.createElement("div"); // img at the reference point
var scrolling = false; // guards one phase


// we check the OS for default middle mouse behavior only!
var isLinux = (navigator.platform.indexOf("Linux") != -1); 

// get global settings
chrome.storage.sync.get(defaultOptions, function (syncedOptions) {
    options = syncedOptions;
    // leave time for the main script to check excluded pages
    setTimeout(function() {
        // if we shouldn't run, stop listening to events
        if (isExcluded && !options.middleMouse) {
            cleanup();
        }
    }, 10);
});

 
/**
 * Initializes the image at the reference point.
 */
function init() {
    var url = chrome.extension.getURL("../img/cursor.png");
    var style = img.style;
    style.background = "url("+url+") no-repeat";
    style.position   = "fixed";
    style.zIndex     = "1000";
    style.width      = "20px";
    style.height     = "20px";
    new Image().src  = url; // force download
}

/**
 * Removes event listeners and other traces left on the page.
 */
function cleanup() {
    removeEvent("mousedown", mousedown);
}

/**
 * Shows the reference image, and binds event listeners for scrolling.
 * It also manages the animation.
 * @param {Object} event
 */
function mousedown(e) {

    // use default action if we're disabled
    // or it's not the midde mouse button
    if (!options.middleMouse || e.button !== 1) {
        return true;
    }

    var isLink = false;
    var elem   = e.target;
    
    // linux middle mouse shouldn't be overwritten (paste)
    var isLinuxInput = (isLinux && /input|textarea/i.test(elem.nodeName));

    do {
        isLink = isNodeName(elem, "a");
        if (isLink) break;
    } while (elem = elem.parentNode);
        
    elem = overflowingAncestor(e.target);
    
    // if it's being used on an <a> element
    // take the default action
    if (!elem || isLink || isLinuxInput) {
        return true;
    }
    
    // we don't want the default by now
    e.preventDefault();
    
    // quit if there's an ongoing scrolling
    if (scrolling) {
        return false;
    }
    
    // set up a new scrolling phase
    scrolling = true;
 
    // reference point
    img.style.left = e.clientX - 10 + "px";
    img.style.top  = e.clientY - 10 + "px";
    document.body.appendChild(img);
    
    var refereceX = e.clientX;
    var refereceY = e.clientY;

    var speedX = 0;
    var speedY = 0;
    
    // animation loop
    var last = +new Date;
    var delay = 1000 / options.frameRate;
    var finished = false;
    
    requestFrame(function step(time) {
        var now = time || +new Date;
        var elapsed = now - last;
        elem.scrollLeft += (speedX * elapsed) >> 0;
        elem.scrollTop  += (speedY * elapsed) >> 0;
        last = now;
        if (!finished) {
            requestFrame(step, elem, delay);
        }
    }, elem, delay);
    
    var firstMove = true;

    function mousemove(e) {
        var deltaX = Math.abs(refereceX - e.clientX);
        var deltaY = Math.abs(refereceY - e.clientY);
        var movedEnough = Math.max(deltaX, deltaY) > 10; 
        if (firstMove && movedEnough) {
            addEvent("mouseup", remove);
            firstMove = false;
        }
        speedX = (e.clientX - refereceX) * 10 / 1000;
        speedY = (e.clientY - refereceY) * 10 / 1000;
    }
    
    function remove(e) {
        removeEvent("mousemove", mousemove);
        removeEvent("mousedown", remove);
        removeEvent("mouseup", remove);
        removeEvent("keydown", remove);
        document.body.removeChild(img);
        scrolling = false;
        finished  = true;
    }
    
    addEvent("mousemove", mousemove);
    addEvent("mousedown", remove);
    addEvent("keydown", remove);
}

addEvent("mousedown", mousedown);
addEvent("DOMContentLoaded", init);

})(window);
