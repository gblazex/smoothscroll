
/**
 * Options page logic.
 */
(function(window, undefined){

/**
 * List of available options
 */
var options = [
  'animtime',
  'scrollsz',
  'arrscroll',
  'middlemouse',
  'accelMax',
  'accelDelta',
  'pulseAlgorithm',
  'pulseScale',
  'keyboardsupport',
  'exclude',
  'fixedback'
];

function byId(id) { return document.getElementById(id); }
function byClass(cname) { return document.getElementsByClassName(cname); }
function byTag(tag,base) { return (base||document).getElementsByTagName(tag||'*'); }

function isNodeName(el, tag) {
    return el.nodeName.toLowerCase() === tag.toLowerCase();
}

function show(elem, newop) {
    elem.style.display = "block";
    elem.style.webkitTransition = "opacity 0.2s ease-in-out";
    setTimeout(function(){
        elem.style.opacity = (newop || 1);
    }, 0);
}

function hide(elem, newop) {
    elem.style.webkitTransition = "opacity 1s ease-in-out";
    elem.style.opacity = (newop || 0);
    setTimeout(function(){
        elem.style.display = "none";
    }, 1000);
}

/**
 * Fills up the form with the saved values from local storage.
 */
function init() {

    // settings were updated -> show dialog
    if (localStorage.saved == 'true') {
        var dialog  = byClass('dialog')[0];
        show(dialog, 0.9);
        setTimeout(function () {
            hide(dialog);
        }, 3000);
    }

    // updated complete
    localStorage.saved = 'false';
        
    // fill the form fields from localStorage
    options.forEach(function(key, i) {
        if (/keyboardsupport|middlemouse|pulseAlgorithm|fixedback/.test(key)) {
            byId(key).checked = (localStorage[key] == "true");
        } else if (localStorage[key]) {
            byId(key).value = localStorage[key];
        }
    });
}

/**
 * Saves the values from the form to local storage.
 */
function save() {

    var i, key, opt, elem, error;

    // save options to the local storage
    options.forEach(function(key, i) {
        // <input type="text"> and <textarea>
        if (!/keyboardsupport|middlemouse|pulseAlgorithm|fixedback/.test(key)) {
            elem = byId(key);
            opt = elem.value;
            // every <input> 
            if (isNodeName(elem, "input")) {
              // should be a number
              opt = parseFloat(opt, 10);
              if (isNaN(opt)) {
                  error = "Numeric Values Only!";
                  return; // stop iteration
               }
            }
            localStorage[key] = opt;
        } else { // checkbox
            localStorage[key] = byId(key).checked;
        }
    });

    // update message
    if (!error) {
        localStorage.saved = 'true';
        reload();
    }
    // error message
    else {
        alert(error);
    } 
}

function get_manifest(callback) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        callback(JSON.parse(xhr.responseText));
    };
    xhr.open('GET', '../manifest.json', true);
    xhr.send(null);
}

get_manifest(function (manifest) {
    version = manifest.version;
    byId("version").innerHTML = version;
});

function reload() {
    window.location.reload();
}


var profiles = {

  '_custom': {
    'animtime': 160,
    'scrollsz': 120,
    'pulseAlgorithm': 'true',
    'pulseScale': 4
  },

  '_default': {
    'animtime': 400,
    'scrollsz': 120,
    'pulseAlgorithm': 'true',
    'pulseScale': 8
  },

  '_iphone': {
    'animtime': 400,
    'scrollsz': 120,
    'pulseAlgorithm': 'true',
    'pulseScale': 4
  },
  
  '_opera': {
    'animtime': 120,
    'scrollsz': 120,
    'pulseAlgorithm': 'false'
  },
  
  '_ie9': {
    'animtime': 60,
    'scrollsz': 120,
    'pulseAlgorithm': 'false'
  }
};

// TODO: merge with init
function set_profile(profile) {

    if ('custom' == profile){
      init();
      return;
    }  

    profile = profiles['_'+profile];

    // set
    for (var key in profile) {
        if (/keyboardsupport|middlemouse|pulseAlgorithm|fixedback/.test(key)) {
            byId(key).checked = (profile[key] == "true");
        } else if (localStorage[key]) {
            byId(key).value = profile[key];
        }
    };
}

// Restores select box state to saved value from localStorage.
//function restore_options() {
//}

function generate_test() {
    var test = byId('test');
    var el = byTag('div', test)[0];
    for (var i = 5; i--;) {
      test.appendChild(el.cloneNode(true));
    }
}



byId('profiles').onclick = function(e) {
  if (e.target.id && e.nodeName == 'BUTTON') {
    set_profile(e.target.id);
  }
};

byId('save').onclick = save;

// public interface
window.addEventListener("DOMContentLoaded", init, false);
window.addEventListener("DOMContentLoaded", generate_test, false);
window.reload = reload;
window.save = save;
window.set_profile = set_profile;

})(window);
