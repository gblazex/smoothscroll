
// SmoothScroll v0.8.6
// Licensed under the terms of the MIT license.

// People involved
// - Balazs Galambosi: maintainer (CHANGELOG.txt)
// - Patrick Brunner (patrickb1991@gmail.com)
// - Michael Herf: Pulse Algorithm
// - Frank Yan: Direction Switching Fixes
// - Ismael Barros: Keyboard Fixes

(function(window){

// Frame Variables
var frame = false;
var noscrollframe = false;
var lastYOffset = 0;

// Scroll Variables (tweakables)
var framerate = 50;  // [Hz]
var animtime  = 400; // [px]
var scrollsz  = 120; // [px]

// Pulse (less tweakables)
// ratio of 'tail' to 'acceleration'
var pulseAlgorithm = true;
var pulseScale     = 8;
var pulseNormalize = 1;

// Keyboard Settings
var keyboardsupport = true;
var arrscroll = 50;  // [px]
var pgscroll  = 800; // [px] unused
var exclude   = "";

// Arrays of timeouts
var up   = [];
var down = [];

// Other Variables
var scrolls;
var lastScrollTop = 1337; // 1337??
var delta    = 0;
var initdone = false;
var disableKeyboard = false;
var key = { up: 38, down: 40, spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36 };


/***********************************************
 * SETTINGS
 ***********************************************/

var port = chrome.extension.connect({
    name: "smoothscroll"
});
port.onMessage.addListener(function (settings) {
    
    // NOTE: + converts to {Number}
    framerate = +settings.framerate;
    animtime  = +settings.animtime;
    scrollsz  = +settings.scrollsz;

    pulseAlgorithm = (settings.pulseAlgorithm == "true");
    pulseScale     = +settings.pulseScale;
    pulseNormalize = +settings.pulseNormalize;

    keyboardsupport = (settings.keyboardsupport == "true");
    arrscroll = +settings.arrscroll;
    //pgscroll  = +settings.pgscroll;
    exclude   = settings.exclude;
    
    scrolls = setupScrolls();
    computePulseScale();
    
    // it seems that sometimes settings come late
    // and we need to test again for excluded pages
    initTest();

    if (keyboardsupport && !disableKeyboard) {
        document.onkeydown = keydown;
    }

    // If extension settings were deleted somehow
    if (!framerate) {
        alert("SmoothScroll: Please restart Chrome");
    }
});



/***********************************************
 * INITIALIZE
 ***********************************************/

/**
 * Tests if smooth scrolling is allowed. Shuts down everything if not.
 */
function initTest() {
    var embed = document.getElementsByTagName('embed')[0];
    if (embed && embed.type === "application/pdf") {
        window.onmousewheel = null;
        disableKeyboard = true;
    } else if (document.URL.indexOf("google.com/reader/view") > -1) {
        disableKeyboard = true;
    } else if (exclude) {
        var domains = exclude.split(/[,\n] ?/);
        for (var i = domains.length; i--;) {
            if (document.URL.indexOf(domains[i]) > -1) {
                window.onmousewheel = null;
                disableKeyboard = true;
                break;
            }
        }
    }
    
    if (disableKeyboard) {
        document.onkeydown = null;
    }
}

/**
 * Fills up the scrolls array with easing values.
 * Uses pulse to make it smooth.
 */
function setupScrolls() {

    scrolls = [];

    var last = 0;
    var frames = Math.floor(framerate * animtime / 1000);

    for (var i = 0; i < frames; i++) {
        // scroll is [0, 1]
        var scroll = (i + 1) / frames;
        // transform [0, 1] -> [0, 1]:
        if (pulseAlgorithm) {
           scroll = pulse(scroll);
        }
       
        // scale and quantize to int so our pixel difference works:
        var iscroll = Math.floor(scrollsz * scroll + 0.99);
        scrolls.push(iscroll - last);
        last = iscroll;
    }

    return scrolls;
}

/**
 * Sets up scrolls array, determines if frames are involved.
 */
function init() {
  
    var body = document.body;

    initTest();

    if (!scrolls) {
      scrolls = setupScrolls();
    }

    // Checks if this script is running in a frame
    if (top != self) {
        frame = true;
        // document.documentElement ?
        if (body.scrollHeight <= body.clientHeight + 10) {
            noscrollframe = true;
        }
    }
   
    /**
     * This fixes a bug where the areas left and right 
     * to the content does not trigger the onmousewheel
     * event on some pages. Acid3 test is excluded.
     */
    if (document.URL !== "http://acid3.acidtests.org/") {
        var underlay = document.createElement('div');
        underlay.setAttribute( "style",
            "z-index: -1; position:absolute; top:0; left: 0; " +
            "width: 100%; height: " + body.scrollHeight + "px;" );
        body.appendChild(underlay);
    }
    initdone = true;
}


/***********************************************
 * EVENTS
 ***********************************************/

/**
 * Mouse wheel handler.
 * NOTE: function logic should be decomposed.
 * @param {Object} event
 */
function wheel(event) {

    if (!initdone) {
        init();
    }

    var scroll = true;
    var prevent = false;
    var scrollup = true;
    var scrolldown = true;
    var lastdelta = delta;
    var i, overflow, delay, elem, dir;

    delta = event.wheelDelta || 0;

    // normalize delta
    if (delta) {
        ///simple: delta /= Math.abs(delta);
        delta /= 120;
        // synaptics seems to send 1 sometimes, 
        // and 120 other times (fix)
        if (Math.abs(delta) < 0.01) {
            delta *= 120;
        }
    }

    dir = (delta > 0) ? up : down;
    elem = overflowingAncestor(event.target);
  
    if (!elem) {
        return true;
    }
    
    if (elem === document.body) {
        scroll = true;
    } else { // other overflowing element
        prevent = true;
        if (elem.scrollTop === lastScrollTop) {
            if (elem.scrollTop === 0) {
                scrollup   = true;
                scrolldown = false;
            } else {
                scrolldown = true;
                scrollup   = false;
            }
        } else {
            scroll = false;
        }
        lastScrollTop = elem.scrollTop;
        scrollElement(elem, delta, 1); // Fixes a bug
        clearTimeouts(dir === up ? down : up);
        for (i = 0; i < 10; i++) {
            delay = i * 1000 / framerate + 1;
            dir.push(setTimeout(function() {
                scrollElement(elem, delta, 10);
            }, delay));
        }
    }

    if (frame) {
        if (noscrollframe) {
            scroll = false;
        } else {
            // the last scroll did nothing
            if (lastYOffset === window.pageYOffset) {
                // scrolling downwards did nothing
                if (lastdelta < 0) {
                    scrollup   = true;
                    scrolldown = false;
                } 
                // scrolling upwards did nothing
                else if (lastdelta > 0) {
                    scrollup   = false;
                    scrolldown = true;
                } 
            }
            lastYOffset = window.pageYOffset;
        }
    }
    if (scroll) {
        if ((scrolldown && delta < 0) || (scrollup && delta > 0)) {
            scrollArray(dir, -delta);
            event.preventDefault();
        }
    }
    // Prevention for scrollable html elements
    if (prevent) {
        event.preventDefault();
    }
}


/**
 * Keydown event handler.
 * @param {Object} event
 */
function keydown(event) {

    var target   = event.target;
    var modifier = event.ctrlKey || event.altKey || event.metaKey;

    // do nothing if user is editing text
    // or using a modifier key (except shift)
    if ( isNodeName(target, "input")    ||
         isNodeName(target, "textarea") || 
         target.isContentEditable       || 
         modifier ) {
      return true;
    }
 
    var scale, dir, shift;
    
    switch (event.keyCode) {
        case key.up:
            scale = -arrscroll;
            dir = up; 
            break;
        case key.down:
            scale = arrscroll;
            dir = down; 
            break;
        case key.spacebar:
            shift = event.shiftKey ? 1 : -1; // (+ shift)
            scale = -shift * window.innerHeight;
            dir = (shift > 0) ? up : down; 
            break;
        case key.pageup:
            scale = -window.innerHeight;
            dir = up; 
            break;
        case key.pagedown:
            scale = window.innerHeight;
            dir = down; 
            break;
        case key.home:
            scale = -target.scrollTop;
            dir = up; 
            break;
        case key.end:
            var damt = target.scrollHeight - target.scrollTop - window.innerHeight;
            scale = (damt > 0) ? damt : 0;
            dir = down; 
            break;
        default:
            return true; // a key we don't care about
    }
    
    scrollArray(dir, scale / scrollsz, 1000);
    event.preventDefault();
}


/***********************************************
 * HELPERS
 ***********************************************/
 
function isNodeName(el, tag) {
    return el.nodeName.toLowerCase() === tag.toLowerCase();
}

function clearTimeouts(array) {
    while (array.length) {
        clearTimeout(array.pop());
    }
}

function overflowingAncestor(el) {
    var bodyScrollHeight = document.body.scrollHeight;
    do {
        if (bodyScrollHeight === el.scrollHeight) {
            return document.body;
        }
        else if (el.clientHeight + 10 < el.scrollHeight) {
            overflow = getComputedStyle(el, "").getPropertyValue("overflow");
            if (overflow === "scroll" || overflow === "auto") {
                return el;
            }
        }
    } while (el = el.parentNode);
}


/***********************************************
 * PULSE
 ***********************************************/
 
/**
 * Viscous fluid with a pulse for part and decay for the rest.
 * - Applies a fixed force over an interval (a damped acceleration), and
 * - Lets the exponential bleed away the velocity over a longer interval
 * - Michael Herf, http://stereopsis.com/stopping/
 */
function pulse_(x) {
    var val, start, expx;
    // test
    x = x * pulseScale;
    if (x < 1) {
        val = x - (1 - Math.exp(-x));
    } else {
        // the previous animation ended here:
        start = Math.exp(-1);
        // simple viscous drag
        x -= 1;
        expx = 1 - Math.exp(-x);
        val = start + (expx * (1 - start));
    }
    return val * pulseNormalize;
}

function computePulseScale() {
    pulseNormalize = 1 / pulse_(1);
}

/**
 * Viscous fluid with a pulse for part and decay for the rest
 */
function pulse(x) {
    if (x >= 1) return 1;
    if (x <= 0) return 0;

    if (pulseNormalize == 1) {
        computePulseScale();
    }
    return pulse_(x);
}


/************************************************
 * SCROLLING 
 ************************************************/

/**
 * Scrolls an element by a given amount.
 */
function scrollElement(el, delta, amount) {
    if (delta > 0) {
        el.scrollTop -= amount;
    } else {
        el.scrollTop += amount;
    }
}

/**
 * Pushes scroll actions to a given direction Array.
 */
function scrollArray(dir, multiply, delay) {
    delay || (delay = 1000);
    clearTimeouts(dir === up ? down : up);
    function step() {
        window.scrollBy( 0 , multiply * scrolls[i++] );
    }
    for (var i = scrolls.length; i--;) {
        dir.push(setTimeout(step, i * delay / framerate + 1));
    }
    i = 0; // reset so that step() can increment again   
}

window.addEventListener("mousewheel", wheel, false);
window.addEventListener("DOMContentLoaded", init, false);

})(window);
