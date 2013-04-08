
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
    pulseScale        : 8,
    pulseNormalize    : 1,

    // Acceleration
    accelerationDelta : 20,  // 20
    accelerationMax   : 1,   // 1

    // Keyboard Settings
    keyboardSupport   : true,  // option
    arrowScroll       : 50,     // [px]

    // Other
    touchpadSupport   : true,
    fixedBackground   : true, 
    excluded          : "example.com, another.example.com"    
}


// Fired when the extension is first installed, 
// when the extension is updated to a new version, 
// and when Chrome is updated to a new version.
chrome.runtime.onInstalled.addListener(init);

function init(details ) {
  if (details.reason == "install") {
    chrome.storage.sync.set(defaultOptions);
  }
}
