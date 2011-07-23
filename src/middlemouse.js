
// SmoothScroll v1.0.1
// Licensed under the terms of the MIT license.
// Balázs Galambosi (c) 2011

/**
 * A module for middle mouse scrolling.
 */
(function(window){

// local settings
var img = document.createElement("div"); // img at the reference point
var scrolling = false; // guards one phase
var framerate = 200;

// we check the OS for default middlemouse behavior only!
var isLinux   = (navigator.platform.indexOf("Linux") != -1);

// get global settings
chrome.extension.connect({ name: "smoothscroll"}).
onMessage.addListener(function (settings) {
    if (disabled || settings.middlemouse === 'false') {
        return;
    }
    framerate = +settings.framerate + 50;

    addEvent("mousedown", mousedown);
    addEvent("DOMContentLoaded", init);
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
 * Shows the reference image, and binds event listeners for scrolling.
 * It also manages the animation.
 * @param {Object} event
 */
function mousedown(e) {

    var isLink = false;
    var elem   = e.target;

    // linux middle mouse shouldn't be overwritten (paste)
    var linux = (isLinux && /INPUT|TEXTAREA/.test(elem.nodeName));

    do {
        isLink = elem.nodeName === 'A';
        if (isLink) break;
    } while (elem = elem.parentNode);

    elem = overflowingAncestor(e.target);

    // if it's not the middle button, or
    // it's being used on an <a> element
    // take the default action
    if (!elem || e.button !== 1 || isLink || linux) {
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
    var delay = 1000 / framerate;
    var finished = false;

    requestFrame(function step(time){
        var now = time || +new Date;
        var elapsed = now - last;
        elem.scrollLeft += (speedX * elapsed) >> 0;
        elem.scrollTop  += (speedY * elapsed) >> 0;
        last = now;
        if (!finished) {
            requestFrame(step, elem, delay);
        }
    }, elem, delay);

    var first = true;

    function mousemove(e) {
        if (first) {
            addEvent("mouseup", remove);
            first = false;
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

})(window);
