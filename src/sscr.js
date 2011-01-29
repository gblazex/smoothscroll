
// SmoothScroll v0.9.9
// Licensed under the terms of the MIT license.

// People involved
// - Balazs Galambosi: maintainer (CHANGELOG.txt)
// - Patrick Brunner (patrickb1991@gmail.com)
// - Michael Herf: Pulse Algorithm

// Scroll Variables (tweakable)
var framerate = 150; // [Hz]
var animtime  = 400; // [px]
var stepsize  = 120; // [px]

// Pulse (less tweakable)
// ratio of "tail" to "acceleration"
var pulseAlgorithm = true;
var pulseScale     = 8;
var pulseNormalize = 1;

// Keyboard Settings
var keyboardsupport = true;
var disableKeyboard = false;
var arrowscroll     = 50; // [px]

// Excluded pages
var exclude = "";

// Other Variables
var frame = false;
var direction = { x: 0, y: 0 };
var initdone  = false;
var fixedback = true;
var activeElement;
var root;

var key = { left: 37, up: 38, right: 39, down: 40, spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36 };


/***********************************************
 * SETTINGS
 ***********************************************/

chrome.extension.connect({ name: "smoothscroll" }).
onMessage.addListener(function (settings) {
    
    // NOTE: + converts to {Number}
    framerate = +settings.framerate;
    animtime  = +settings.animtime;
    stepsize  = +settings.scrollsz;
    exclude   = settings.exclude;
    pulseAlgorithm  = (settings.pulseAlgorithm == "true");
    pulseScale      = +settings.pulseScale;
    keyboardsupport = (settings.keyboardsupport == "true");
    arrowscroll     = +settings.arrscroll;
    fixedback       = (settings.fixedback == "true");
    
    // it seems that sometimes settings come late
    // and we need to test again for excluded pages
    initTest();

    if (keyboardsupport && !disableKeyboard) {
        addEvent("keydown", keydown);
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

    // disable keys for google reader (spacebar conflict)
    if (document.URL.indexOf("google.com/reader/view") > -1) {
        disableKeyboard = true;
    }
    
    // disable everything if the page is blacklisted
    if (exclude) {
        var domains = exclude.split(/[,\n] ?/);
        for (var i = domains.length; i--;) {
            if (document.URL.indexOf(domains[i]) > -1) {
                removeEvent("mousewheel", wheel);
                disableKeyboard = true;
                break;
            }
        }
    }
    
    // disable keyboard support if anything above requested it
    if (disableKeyboard) {
        removeEvent("keydown", keydown);
    }
}

/**
 * Sets up scrolls array, determines if frames are involved.
 */
function init() {
  
    if (!document.body) return;

    var body = document.body;
    var html = document.documentElement;
    var windowHeight = window.innerHeight; 
    var scrollHeight = body.scrollHeight;
    
    // check compat mode for root element
    root = (document.compatMode.indexOf('CSS') >= 0) ? html : body;
    activeElement = body;
    
    initTest();
    initdone = true;

    // Checks if this script is running in a frame
    if (top != self) {
        frame = true;
    }

    /**
     * This fixes a bug where the areas left and right to 
     * the content does not trigger the onmousewheel event
     * on some pages. e.g.: html, body { height: 100% }
     */
    else if (scrollHeight > windowHeight &&
            (body.offsetHeight <= windowHeight || 
             html.offsetHeight <= windowHeight)) {
        root.style.height = "auto";
        if (root.offsetHeight <= windowHeight) {
            var underlay = document.createElement("div"); 	
            underlay.style.clear = "both";
            body.appendChild(underlay);
        }
    }
    
    if (document.URL.indexOf("mail.google.com") > -1) {
        var s = document.createElement("style");
        s.innerHTML = ".iu { visibility: hidden }";
        (document.getElementsByTagName("head")[0] || html).appendChild(s);
    }
    if (!fixedback) {
        body.style.backgroundAttachment = "scroll";
    }
}


/************************************************
 * SCROLLING 
 ************************************************/
 
var que = [];
var pending = false;

/**
 * Pushes scroll actions to the scrolling queue.
 */
function scrollArray(elem, left, top, delay) {
    
    delay || (delay = 1000);
    directionCheck(left, top);
    
    // push a scroll command
    que.push({
        x: left, 
        y: top, 
        lastX: (left < 0) ? 0.99 : -0.99,
        lastY: (top  < 0) ? 0.99 : -0.99, 
        start: +new Date
    });
        
    // don't act if there's a pending queue
    if (pending) {
        return;
    }
            
    var step = function() {
        
        var now = +new Date;
        var scrollX = 0;
        var scrollY = 0; 
    
        for (var i = 0; i < que.length; i++) {
            
            var item = que[i];
            var elapsed  = now - item.start;
            var finished = (elapsed >= animtime);
            
            // scroll position: [0, 1]
            var position = (finished) ? 1 : elapsed / animtime;
            
            // easing [optional]
            if (pulseAlgorithm) {
                position = pulse(position);
            }
            
            // only need the difference
            var x = (item.x * position - item.lastX) >> 0;
            var y = (item.y * position - item.lastY) >> 0;
            
            // add this to the total scrolling
            scrollX += x;
            scrollY += y;            
            
            // update last values
            item.lastX += x;
            item.lastY += y;
        
            // delete and step back if it's over
            if (finished) {
                que.splice(i, 1); i--;
            }           
        }

        // scroll left
        if (left) {
            var lastLeft = elem.scrollLeft;
            elem.scrollLeft += scrollX;
            
            // scroll left failed (edge)
            if (scrollX && elem.scrollLeft === lastLeft) {
                left = 0;
            }
        }

        // scroll top
        if (top) {
            var lastTop = elem.scrollTop;
            elem.scrollTop += scrollY;
            
            // scroll top failed (edge)
            if (scrollY && elem.scrollTop === lastTop) {
                top = 0;
            }            
        }
        
        // clean up if there's nothing left to do
        if (!left && !top) {
            que = [];
        }
        
        if (que.length) { 
            setTimeout(step, delay / framerate + 1);
        } else { 
            pending = false;
        }
    }
    
    // start a new queue of actions
    setTimeout(step, 0);
    pending = true;
}


/***********************************************
 * EVENTS
 ***********************************************/

/**
 * Mouse wheel handler.
 * @param {Object} event
 */
function wheel(event) {

    if (!initdone) {
        init();
    }
    
    var target = event.target;
    var overflowing = overflowingAncestor(target);
    
    // use default if there's no overflowing
    // element or default action is prevented    
    if (!overflowing || event.defaultPrevented ||
        isNodeName(activeElement, "embed") ||
       (isNodeName(target, "embed") && /\.pdf/i.test(target.src))) {
        return true;
    }

    var deltaX = event.wheelDeltaX || 0;
    var deltaY = event.wheelDeltaY || 0;
    
    // use wheelDelta if deltaX/Y is not available
    if (!deltaX && !deltaY) {
        deltaY = event.wheelDelta || 0;
    }

    // scale by step size
    // delta is 120 most of the time
    // synaptics seems to send 1 sometimes
    if (Math.abs(deltaX) > 1.2) {
        deltaX *= stepsize / 120;
    }
    if (Math.abs(deltaY) > 1.2) {
        deltaY *= stepsize / 120;
    }
    
    scrollArray(overflowing, -deltaX, -deltaY);
    event.preventDefault();
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
    if ( /input|textarea|embed/i.test(target.nodeName) ||
         target.isContentEditable || 
         event.defaultPrevented   ||
         modifier ) {
      return true;
    }
    // spacebar should trigger button press
    if (isNodeName(target, "button") &&
        event.keyCode === key.spacebar) {
      return true;
    }
    
    var shift, x = 0, y = 0;
    var elem = overflowingAncestor(activeElement);
    var clientHeight = elem.clientHeight;

    if (elem == document.body) {
        clientHeight = window.innerHeight;
    }

    switch (event.keyCode) {
        case key.up:
            y = -arrowscroll;
            break;
        case key.down:
            y = arrowscroll;
            break;         
        case key.spacebar: // (+ shift)
            shift = event.shiftKey ? 1 : -1;
            y = -shift * clientHeight * 0.9;
            break;
        case key.pageup:
            y = -clientHeight * 0.9;
            break;
        case key.pagedown:
            y = clientHeight * 0.9;
            break;
        case key.home:
            y = -elem.scrollTop;
            break;
        case key.end:
            var damt = elem.scrollHeight - elem.scrollTop - clientHeight;
            y = (damt > 0) ? damt+10 : 0;
            break;
        case key.left:
            x = -arrowscroll;
            break;
        case key.right:
            x = arrowscroll;
            break;            
        default:
            return true; // a key we don't care about
    }

    scrollArray(elem, x, y);
    event.preventDefault();
}

/**
 * Mousedown event only for updating activeElement
 */
function mousedown(event) {
    activeElement = event.target;
}


/***********************************************
 * OVERFLOW
 ***********************************************/
 
var cache = {}; // cleared out every once in while
setInterval(function(){ cache = {}; }, 10 * 1000);

var uniqueID = (function() {
    var i = 0;
    return function (el) {
        return el.uniqueID || (el.uniqueID = i++);
    };
})();

function setCache(elems, overflowing) {
    for (var i = elems.length; i--;)
        cache[uniqueID(elems[i])] = overflowing;
    return overflowing;
}

function overflowingAncestor(el) {
    var elems = [];
    var rootScrollHeight = root.scrollHeight;
    do {
        var cached = cache[uniqueID(el)];
        if (cached) {
            return setCache(elems, cached);
        }
        elems.push(el);
        if (rootScrollHeight === el.scrollHeight) {
            if (!frame || root.clientHeight + 10 < rootScrollHeight) {
                return setCache(elems, document.body); // scrolling root in WebKit
            }
        } else if (el.clientHeight + 10 < el.scrollHeight) {
            overflow = getComputedStyle(el, "").getPropertyValue("overflow");
            if (overflow === "scroll" || overflow === "auto") {
                return setCache(elems, el);
            }
        }
    } while (el = el.parentNode);
}


/***********************************************
 * HELPERS
 ***********************************************/

function addEvent(type, fn, bubble) {
    window.addEventListener(type, fn, (bubble||false));
}

function removeEvent(type, fn, bubble) {
    window.removeEventListener(type, fn, (bubble||false));  
}

function isNodeName(el, tag) {
    return el.nodeName.toLowerCase() === tag.toLowerCase();
}

function directionCheck(x, y) {
    x = (x > 0) ? 1 : -1;
    y = (y > 0) ? 1 : -1;
    if (direction.x !== x || direction.y !== y) {
        direction.x = x;
        direction.y = y;
        que = [];
    }
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
    if (x < 1) { // acceleartion
        val = x - (1 - Math.exp(-x));
    } else {     // tail
        // the previous animation ended here:
        start = Math.exp(-1);
        // simple viscous drag
        x -= 1;
        expx = 1 - Math.exp(-x);
        val = start + (expx * (1 - start));
    }
    return val * pulseNormalize;
}

function pulse(x) {
    if (x >= 1) return 1;
    if (x <= 0) return 0;

    if (pulseNormalize == 1) {
        pulseNormalize /= pulse_(1);
    }
    return pulse_(x);
}

addEvent("mousedown", mousedown);
addEvent("mousewheel", wheel);
addEvent("load", init);
