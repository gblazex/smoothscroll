
// SmoothScroll v0.9.7
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
var direction = "down";
var initdone  = false;
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
    
    computePulseScale();
    
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
  
    var body  = document.body;
    var docel = document.documentElement;
    var windowHeight = window.innerHeight; 
    var htmlHeight   = docel.offsetHeight;
    
    // check compat mode for root element
    root = (document.compatMode.indexOf('CSS') >= 0) ?  docel : body;
    activeElement = body;
    
    initTest();
    
    if (document.domain === "acid3.acidtests.org") return;

    // Checks if this script is running in a frame
    if (top != self) {
        frame = true;
    }

    /**
     * This fixes a bug where the areas left and right to 
     * the content does not trigger the onmousewheel event
     * on some pages. e.g.: html, body { height: 100% }
     */
    else if (body.scrollHeight > windowHeight &&
            (body.offsetHeight <= windowHeight || htmlHeight <= windowHeight)) {

        var underlay = document.createElement("div");
        underlay.setAttribute( "style",
            "z-index: -1; position: absolute; top: 0; left: 0; " +
            "width: 100%; height: " + body.scrollHeight + "px;" );    
        body.appendChild(underlay);

        var scrollHeight = body.scrollHeight;
        var pending = false;
        
        // DOMChange delayed
        var refresh = function() {
            if (!pending && scrollHeight != body.scrollHeight) {
                pending = true; // add a new pending action
                setTimeout(function(){
                    underlay.style.height = body.scrollHeight + "px";
                    scrollHeight = body.scrollHeight; 
                    pending = false;
                }, 1000); // act rarely to stay fast
            }
        }

        addEvent("DOMNodeInserted", refresh);
        addEvent("DOMNodeRemoved",  refresh);
    }
    initdone = true;
}


/************************************************
 * SCROLLING 
 ************************************************/
 
var que = [];
var pending = false;

/**
 * Pushes scroll actions to the scrolling queue.
 */
function scrollArray(elem, dir, multiplyX, multiplyY, delay) {
    
    delay || (delay = 1000);
    directionCheck(dir);
    
    // push a scroll command
    que.push({
        x: multiplyX, 
        y: multiplyY, 
        lastX: (multiplyX < 0) ? 0.99 : -0.99,
        lastY: (multiplyY < 0) ? 0.99 : -0.99, 
        start: +new Date
    });
        
    // don't act if there's a pending queue
    if (pending) {
        return;
    }
            
    var step = function() {
        
        var now = +new Date;
        var totalX = 0;
        var totalY = 0; 
    
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
            var scrollX = (item.x * position - item.lastX) >> 0;
            var scrollY = (item.y * position - item.lastY) >> 0;
            
            // add this to the total scrolling
            totalX += scrollX;
            totalY += scrollY;            
            
            // update last values
            item.lastX += scrollX;
            item.lastY += scrollY;
        
            // delete and step back if it's over
            if (finished) {
                que.splice(i, 1); i--;
            }           
        }

        // scroll left
        if (multiplyX) {
            var lastLeft = elem.scrollLeft;
            elem.scrollLeft += totalX;
            
            // scroll left failed (edge)
            if (totalX && elem.scrollLeft === lastLeft) {
                multiplyX = 0;
            }
        }
        
        // scroll top
        if (multiplyY) {
            var lastTop = elem.scrollTop;
            elem.scrollTop += totalY;
            
            // scroll top failed (edge)
            if (totalY && elem.scrollTop === lastTop) {
                multiplyY = 0;
            }            
        }
        
        // clean up if there's nothing left to do
        if (!multiplyX && !multiplyY) {
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
 * NOTE: function logic should be decomposed.
 * @param {Object} event
 */
function wheel(event) {

    if (!initdone) {
        init();
    }
    
    var target = event.target;
    var noScrollFrame = (root.scrollHeight <= root.clientHeight + 10);
       
    // use default if there's no overflowing
    // element or default action is prevented
    var elem = overflowingAncestor(target); 
    if (!elem || noScrollFrame || event.defaultPrevented ||
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
    
    var dir = (deltaY > 0) ? "up" : "down";
    scrollArray(elem, dir, -deltaX, -deltaY);
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
    
    var dir, shift, scaleX = 0, scaleY = 0;
    var elem = overflowingAncestor(activeElement);
    var clientHeight = elem.clientHeight;

    if (elem == document.body) {
        clientHeight = window.innerHeight;
    }

    switch (event.keyCode) {
        case key.up:
            scaleY = -arrowscroll;
            dir = "up"; 
            break;
        case key.down:
            scaleY = arrowscroll;
            dir = "down"; 
            break;         
        case key.spacebar: // (+ shift)
            shift = event.shiftKey ? 1 : -1;
            scaleY = -shift * clientHeight * 0.9;
            dir = (shift > 0) ? "up" : "down"; 
            break;
        case key.pageup:
            scaleY = -clientHeight * 0.9;
            dir = "up"; 
            break;
        case key.pagedown:
            scaleY = clientHeight * 0.9;
            dir = "down"; 
            break;
        case key.home:
            scaleY = -elem.scrollTop;
            dir = "up"; 
            break;
        case key.end:
            var damt = elem.scrollHeight - elem.scrollTop - clientHeight;
            scaleY = (damt > 0) ? damt+10 : 0;
            dir = "down"; 
            break;
        case key.left:
            scaleX = -arrowscroll;
            break;
        case key.right:
            scaleX = arrowscroll;
            break;            
        default:
            return true; // a key we don"t care about
    }

    scrollArray(elem, dir, scaleX, scaleY);
    event.preventDefault();
}

/**
 * Mousedown event only for updating activeElement
 */
function mousedown(event) {
    activeElement = event.target;
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

function directionCheck(dir) {
    if (direction !== dir) {
        que = [];
        direction = dir;
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

addEvent("mousedown", mousedown);
addEvent("mousewheel", wheel);
addEvent("load", init);
