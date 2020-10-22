var resultOpen = false;
var _scannerIsRunning = false;
var _lastResult = null;
var _isLight = false;
let data = [];
let i = 0;
var sound = new Audio("/static/barcode.wav");

document.getElementById("howManyResult").innerHTML = data.length + "개의 도서";
document.getElementById("howManyResultCancel").innerHTML = data.length + "개의 도서 - 닫기";

function initCameraSelection() {
  var streamLabel = Quagga.CameraAccess.getActiveStreamLabel();

  return Quagga.CameraAccess.enumerateVideoDevices().then(function (devices) {
    var $deviceSelection = document.getElementById("deviceSelection");
    while ($deviceSelection.firstChild) {
      $deviceSelection.removeChild($deviceSelection.firstChild);
    }
    devices.forEach(function (device) {
      //console.log("Camera" || device.deviceId || device.id)
      var $option = document.createElement("option");
      $option.value = device.deviceId || device.id;
      var deviceName = device.label || device.deviceId || device.id || 'Camera';
      $option.appendChild(document.createTextNode(deviceName.slice(0, deviceName.lastIndexOf('('))));
      $option.selected = streamLabel === device.label;
      $deviceSelection.appendChild($option);
    });
  })
}

function checkCapabilities() {
  var track = Quagga.CameraAccess.getActiveTrack();
  var capabilities = {};
  if (typeof track.getCapabilities === 'function') {
    capabilities = track.getCapabilities();
  }
  console.log(capabilities)
  //document.getElementById("log").innerHTML = JSON.stringify(capabilities);
  //jQuery("#log").html(capabilities.deviceId)
  //this.applySettingsVisibility('zoom', capabilities.zoom);
  //this.applySettingsVisibility('torch', capabilities.torch);
}

function resultChange() {
  document.getElementById("howManyResult").innerHTML = data.length + "개의 도서";
  document.getElementById("howManyResultCancel").innerHTML = data.length + "개의 도서 - 닫기";
}

let inputStreams = {
  name: "Live",
  type: "LiveStream",
  target: document.querySelector('#scanner-container'),
  constraints: { // default: 640 x 480
    width: 480,
    height: 320,
    facingMode: "environment"
  },
};

function add(result, Quagga) {
  //console.log("Barcode detected and processed : [" + result.codeResult.code + "]", result);
  var code = result;

  if (
    !data.includes(code) && (
      (code.length == 13 && (code.startsWith('978') || code.startsWith('979')) &&
        (10 - ((code[0] * 1 + code[1] * 3 + code[2] * 1 + code[3] * 3 + code[4] * 1 + code[5] * 3 + code[6] * 1 + code[7] * 3 + code[8] * 1 + code[9] * 3 + code[10] * 1 + code[11] * 3) % 10)) == code[12] * 1)
      ||
      (code.length == 10 && ((code[0] * 1 + code[1] * 2 + code[2] * 3 + code[3] * 4 + code[4] * 5 + code[5] * 6 + code[6] * 7 + code[7] * 8 + code[8] * 9) % 11 == code[9] * 1))
    )
  ) {
    i++;
    data.push(code)
    sound.play();
    let title = '';
    var $node = document.createElement('li'), canvas = Quagga.canvas.dom.image;

    $node.innerHTML =
     `<div class="row">
        <div class="col-md-3">
            <img id="img${i}" width="150px" src="${canvas ? canvas.toDataURL() : '/static/nocover.gif'}"/>
        </div>
        <div class="col-md-7">
            <input type="hidden" name="book[${i}][isbn]" value="${code}">
            <h3 class="text-left"><span id="title${i}"></span></h3>
            <h4 class="text-left">${code}</h4>
            <select class="form-control" style="width: 75px;" name="book[${i}][amount]"><option value="1" selected>1권</option><option value="2">2권</option><option value="3">3권</option></select>
        </div>
        <div class="col-md-2">
            <button id="cancel${i}" class="btn cancelBtn">취소</button>
        </div>
      </div>`

    document.getElementById('thumb').prepend($node);
    $(`#cancel${i}`).on("click", function (e) {
      console.log(e);
      $(this).parentsUntil("#thumb").remove();
      data.splice(data.indexOf(code), 1);
      resultChange();
    })
    $.ajax({ method: "GET", url: `/api/book/${code}` }).done(rs => {
      console.log(rs);
      //console.log(`#title${i}`);

      if (!rs.title.startsWith("#ERR")) {
        $(`#title${i}`).html(rs.title);
        $(`#img${i}`).attr('src', rs.img);
      } else {
        $(`#title${i}`).html("찾을 수 없습니다.");
      }

    })
  }
  resultChange();
  return false;
}

function startScanner() {
  Quagga.init({
    inputStream: inputStreams,
    locator: {
      patchSize: "large",
      halfSample: true,
      debug: {
        showCanvas: true,
        showPatches: true,
        showFoundPatches: true,
        showSkeleton: true,
        showLabels: true,
        showPatchLabels: true,
        showRemainingPatchLabels: true,
        boxFromPatches: {
          showTransformed: true,
          showTransformedBox: true,
          showBB: true
        }
      }
    },
    numOfWorkers: 4,
    frequency: 10,
    decoder: {
      readers: [
        "code_128_reader",
        "ean_reader",
        "ean_8_reader",
        "code_39_reader",
        "code_39_vin_reader",
        "codabar_reader",
        "upc_reader",
        "upc_e_reader",
        "i2of5_reader"
      ],
    },
  }, function (err) {
    if (err) {
      console.log(err);
      return
    }

    var streamLabel = Quagga.CameraAccess.getActiveStreamLabel();

    initCameraSelection();
    checkCapabilities()

    console.log("Initialization finished. Ready to start");
    Quagga.start();

    // Set flag to is running
    _scannerIsRunning = true;
    document.getElementById("btn").innerText = "카메라 끄기";
  });

  Quagga.onProcessed(result => {
    var drawingCtx = Quagga.canvas.ctx.overlay,
      drawingCanvas = Quagga.canvas.dom.overlay;

    if (result) {
      if (result.boxes) {
        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
        result.boxes.filter(function (box) {
          return box !== result.box;
        }).forEach(function (box) {
          console.log(box);
          console.log(typeof box);
          Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
        });
      }

      if (result.box) {
        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
      }

      if (result.codeResult && result.codeResult.code) {
        Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
      }
    }
  });

  Quagga.onDetected(result => {
    add(result.codeResult.code, Quagga)
  });
}

// Start/stop scanner
document.getElementById("btn").addEventListener("click", () => {
  if (_scannerIsRunning) {
    Quagga.stop();
    _scannerIsRunning = false
    document.getElementById("btn").innerText = "카메라 켜기";
  } else {
    startScanner();
  }
}, false);

document.getElementById("torch").addEventListener("change", function () {
  //document.getElementById("log").innerHTML = this.checked;
  //document.getElementById("log").innerHTML = "qwdqw";
  var track = Quagga.CameraAccess.getActiveTrack();
  track.applyConstraints({ advanced: [{ torch: this.checked }] });
}, false);

document.getElementById("deviceSelection").addEventListener("change", function () {
  inputStreams.constraints.deviceId = this.value
  Quagga.stop();
  startScanner();
});

function checkSubmit(e) {
  $("#thumb li").each((i, e) => {
    title = $(e).find(".code span").text()
    option = $(e).find("option").val()
    //alert(title + option)
  });
  return true
}

function man(e) {
  //add(a, Quagga);
  const a = $(e).find("#mannual_isbn").val()
  add(a, Quagga);
  return false
}

function changeResultOpen() {
  resultOpen = !resultOpen;
  document.getElementById("result-area").style.display = resultOpen ? "block" : "none";
}