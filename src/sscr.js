
// SmoothScroll v1.0.1
// Licensed under the terms of the MIT license.

// People involved
//  - Balazs Galambosi (maintainer)
//  - Patrick Brunner  (original idea)
//  - Michael Herf     (Pulse Algorithm)

// Scroll Variables (tweakable)
var framerate = 150; // [Hz]
var animtime  = 400; // [px]
var stepsize  = 120; // [px]

// Pulse (less tweakable)
// ratio of "tail" to "acceleration"
var pulseAlgorithm = true;
var pulseScale     = 8;
var pulseNormalize = 1;

// Acceleration
var acceleration   = true;
var accelDelta     = 20;  // 20
var accelMax       = 1;   // 1

// Keyboard Settings
var keyboardsupport = true;  // option
var arrowscroll     = 50;    // [px]

// Excluded pages
var exclude;
var disabled = false;

// Other Variables
var frame = false;
var direction = { x: 0, y: 0 };
var fixedback = true;
var root = document.documentElement;
var activeElement;

var key = { left: 37, up: 38, right: 39, down: 40, spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36 };


/***********************************************
 * SETTINGS
 ***********************************************/

function initSettings(settings) {
    // disable everything if the page is blacklisted
    exclude = settings.exclude;
    if (exclude) {
        var domains = exclude.split(/[,\n] ?/);
        for (var i = domains.length; i--;) {
            if (document.URL.indexOf(domains[i]) > -1) {
                disabled = true;
                return;
            }
        }
    }

    // NOTE: + converts to {Number}
    framerate  = +settings.framerate;
    animtime   = +settings.animtime;
    stepsize   = +settings.scrollsz;
    accelMax   = +settings.accelMax;
    accelDelta = +settings.accelDelta;
    pulseAlgorithm  = (settings.pulseAlgorithm == "true");
    pulseScale      = +settings.pulseScale;
    keyboardsupport = (settings.keyboardsupport == "true");
    arrowscroll     = +settings.arrscroll;
    fixedback       = (settings.fixedback == "true");

    // If extension settings were deleted somehow
    if (!framerate) {
        alert("SmoothScroll: Please restart Chrome");
    }

    addEvent('load', init);
}


/***********************************************
 * INITIALIZE
 ***********************************************/

/**
 * Sets up scrolls array, determines if frames are involved.
 */
function init() {
    if (!document.body) return;

    var body = document.body;
    var html = document.documentElement;
    var windowHeight = window.innerHeight;
    var scrollHeight = body.scrollHeight;

    addEvent("mousedown", mousedown);
    addEvent("mousewheel", wheel);
    // disable keyboard support if anything above requested it
    // disable keys for google reader (spacebar conflict)
    if (keyboardsupport && document.URL.indexOf("google.com/reader/view") === -1) {
        addEvent("keydown", keydown);
    }

    // check compat mode for root element
    root = (document.compatMode.indexOf('CSS') >= 0) ? html : body;
    activeElement = body;

    setInterval(function(){ cache = {}; }, 10 * 1000);

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

        // DOMChange (throttle): fix height
        var pending = false;
        var refresh = function() {
            if (!pending && html.scrollHeight != document.height) {
                pending = true; // add a new pending action
                setTimeout(function(){
                    html.style.height = document.height + 'px';
                    pending = false;
                }, 500); // act rarely to stay fast
            }
        };
        html.style.height = 'auto';
        setTimeout(refresh, 10);
        addEvent("DOMNodeInserted", refresh);
        addEvent("DOMNodeRemoved",  refresh);

        // clearfix
        if (root.offsetHeight <= windowHeight) {
            var underlay = document.createElement("div");
            underlay.style.clear = "both";
            body.appendChild(underlay);
        }
    }

    // gmail performance fix
    if (document.URL.indexOf("mail.google.com") > -1) {
        var s = document.createElement("style");
        s.innerHTML = ".iu { visibility: hidden }";
        (document.getElementsByTagName("head")[0] || html).appendChild(s);
    }
    // youtube shaking video fix
    else if (location.host === 'www.youtube.com') {
        var player =  document.getElementById("watch-player") ||
                      document.getElementById("watch-player-div");
        if (player) {
            var embed = player.getElementsByTagName("embed");
            embed[0].setAttribute("wmode", "opaque");
            player.innerHTML = player.innerHTML;
        }
    }
    // disable fixed background
    if (!fixedback) {
        body.style.backgroundAttachment = "scroll";
        html.style.backgroundAttachment = "scroll";
    }
}


/************************************************
 * SCROLLING
 ************************************************/

var que = [];
var pending = false;
var lastScroll = +new Date;

/**
 * Pushes scroll actions to the scrolling queue.
 */
function scrollArray(elem, left, top, delay) {

    delay || (delay = 1000);
    directionCheck(left, top);

    if (acceleration) {
        var now = +new Date;
        var elapsed = now - lastScroll;
        if (elapsed < accelDelta) {
            var factor = (1 + (30 / elapsed)) / 2;
            if (factor > 1) {
                factor = Math.min(factor, accelMax);
                left *= factor;
                top  *= factor;
            }
        }
        lastScroll = +new Date;
    }

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

    var scrollWindow = (elem === document.body);

    var step = function(time) {

        var now = time || +new Date;
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

        // scroll left and top
        if (scrollWindow) {
            window.scrollBy(scrollX, scrollY);
        }
        else {
            if (scrollX) elem.scrollLeft += scrollX;
            if (scrollY) elem.scrollTop  += scrollY;
        }

        // clean up if there's nothing left to do
        if (!left && !top) {
            que = [];
        }

        if (que.length) {
            requestFrame(step, elem, (delay / framerate + 1));
        } else {
            pending = false;
        }
    };

    // start a new queue of actions
    requestFrame(step, elem, 0);
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

    var target = event.target;
    var overflowing = overflowingAncestor(target);

    // use default if there's no overflowing
    // element or default action is prevented
    if (!overflowing || event.defaultPrevented ||
        activeElement.nodeName === 'EMBED' ||
       (target.nodeName === 'EMBED' && /\.pdf$/i.test(target.src))) {
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
    var modifier = event.ctrlKey || event.altKey || event.metaKey ||
                  (event.shiftKey && event.keyCode !== key.spacebar);

    // do nothing if user is editing text
    // or using a modifier key (except shift)
    // or in a dropdown
    if ( /INPUT|TEXTAREA|SELECT|EMBED/.test(target.nodeName) ||
         target.isContentEditable ||
         event.defaultPrevented   ||
         modifier ) {
      return true;
    }
    // spacebar should trigger button press
    if (target.nodeName === 'BUTTON' &&
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
            overflow = getComputedStyle(el, "").getPropertyValue("overflow-y");
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

function directionCheck(x, y) {
    x = (x > 0) ? 1 : -1;
    y = (y > 0) ? 1 : -1;
    if (direction.x !== x || direction.y !== y) {
        direction.x = x;
        direction.y = y;
        que = [];
        lastScroll = 0;
    }
}

var requestFrame = (function(){
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              function(callback, element, delay){
                  window.setTimeout(callback, delay || (1000/60));
              };
})();

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

(function() {
  chrome.extension.connect({ name: "smoothscroll" }).onMessage.addListener(initSettings);
}).call(this);
