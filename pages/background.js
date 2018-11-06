
var defaultOptions = {

    // Plugin
    middleMouse       : true, 

    // Scrolling Core
    framerate         : 150, // [Hz]
    animationTime     : 400, // [px]
    stepSize          : 120, // [px]

    // Pulse (less tweakable)
    // ratio of "tail" to "acceleration"
    pulseAlgorithm    : true,
    pulseScale        : 4,
    pulseNormalize    : 1,

    // Acceleration
    accelerationDelta : 20,  // 20
    accelerationMax   : 1,   // 1

    // Keyboard Settings
    keyboardSupport   : true,  // option
    arrowScroll       : 50,    // [px]
    spaceScroll       : 0.9,   // decimal

    // Other
    touchpadSupport   : true,
    fixedBackground   : true, 
    excluded          : "example.com, another.example.com"    
}


// Fired when the extension is first installed, 
// when the extension is updated to a new version, 
// and when Chrome is updated to a new version.
chrome.runtime.onInstalled.addListener(init);

function init(details) {
    if (details.reason == "install") {
        chrome.storage.sync.set(defaultOptions);
        var optionsPage = chrome.runtime.getURL("pages/options.html");
        chrome.tabs.create({ url: optionsPage });
        chrome.tabs.query({}, function (tabs) {
            tabs.forEach(addSmoothScrollToTab);
        });
    }
}

function addSmoothScrollToTab(tab) {
    chrome.tabs.executeScript(tab.id, {
        file: "src/sscr.js",
        allFrames: true
    });
    chrome.tabs.executeScript(tab.id, {
        file: "src/middlemouse.js",
        allFrames: true
    });
}
