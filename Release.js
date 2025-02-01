
let globalCoordinates = {
    lat: 0,
    lng: 0
}

let globalPanoID = undefined

var originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {

    if (method.toUpperCase() === 'POST' &&
        (url.startsWith('https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetMetadata') ||
            url.startsWith('https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch'))) {

        this.addEventListener('load', function () {
            let interceptedResult = this.responseText
            const pattern = /-?\d+\.\d+,-?\d+\.\d+/g;
            let match = interceptedResult.match(pattern)[0];
            let split = match.split(",")

            let lat = Number.parseFloat(split[0])
            let lng = Number.parseFloat(split[1])


            globalCoordinates.lat = lat
            globalCoordinates.lng = lng
        });
    }

    return originalOpen.apply(this, arguments);
};



function placeMarker(safeMode){
    let {lat,lng} = globalCoordinates

    if (safeMode) { 
        const sway = [Math.random() > 0.5,Math.random() > 0.5]
        const multiplier = Math.random() * 4
        const horizontalAmount = Math.random() * multiplier
        const verticalAmount = Math.random() * multiplier
        sway[0] ? lat += verticalAmount : lat -= verticalAmount
        sway[1] ? lng += horizontalAmount : lat -= horizontalAmount
    }

    let element = document.querySelectorAll('[class^="guess-map_canvas__"]')[0]
    if(!element){
        placeMarkerStreaks()
        return
    }

    const latLngFns = {
        latLng:{
            lat: () => lat,
            lng: () => lng,
        }
    }


    const reactKeys = Object.keys(element)
    const reactKey = reactKeys.find(key => key.startsWith("__reactFiber$"))
    const elementProps = element[reactKey]
    const mapElementClick = elementProps.return.return.memoizedProps.map.__e3_.click
    const mapElementPropKey = Object.keys(mapElementClick)[0]
    const mapClickProps = mapElementClick[mapElementPropKey]
    const mapClickPropKeys = Object.keys(mapClickProps)

    for(let i = 0; i < mapClickPropKeys.length ;i++){
        if(typeof mapClickProps[mapClickPropKeys[i]] === "function"){
            mapClickProps[mapClickPropKeys[i]](latLngFns)
        }
    }
}

function placeMarkerStreaks(){
    let {lat,lng} = globalCoordinates
    let element = document.getElementsByClassName("region-map_mapCanvas__0dWlf")[0]
    if(!element){
        return
    }
    const reactKeys = Object.keys(element)
    const reactKey = reactKeys.find(key => key.startsWith("__reactFiber$"))
    const elementProps = element[reactKey]
    const mapElementClick = elementProps.return.return.memoizedProps.map.__e3_.click
    const mapElementClickKeys = Object.keys(mapElementClick)
    const functionString = "(e.latLng.lat(),e.latLng.lng())}"
    const latLngFn = {
        latLng:{
            lat: () => lat,
            lng: () => lng,
        }
    }


    for(let i = 0; i < mapElementClickKeys.length; i++){
        const curr = Object.keys(mapElementClick[mapElementClickKeys[i]])
        let func = curr.find(l => typeof mapElementClick[mapElementClickKeys[i]][l] === "function")
        let prop = mapElementClick[mapElementClickKeys[i]][func]
        if(prop && prop.toString().slice(5) === functionString){
            prop(latLngFn)
        }
    }
}



function mapsFromCoords() { 

    const {lat,lng} = globalCoordinates
    if (!lat || !lng) {
        return;
    }

    if (nativeOpen) {
        const nativeOpenCodeIndex = nativeOpen.toString().indexOf('native code')


        if (nativeOpenCodeIndex === 19 || nativeOpenCodeIndex === 23) {
            nativeOpen(`https://maps.google.com/?output=embed&q=${lat},${lng}&ll=${lat},${lng}&z=5`);
        }
    }
}


fetch(`https://geoguessrping.0x978.com/ping?script_version=13`)

const scripts = document.querySelectorAll('script');
scripts.forEach(script => {
    if (script.id === "resolver-cheat-detection-script") {
        script.remove()
    }
});

let onKeyDown = (e) => {
    if (e.keyCode === 49) {
        e.stopImmediatePropagation(); 
        placeMarker(true)
    }
    if (e.keyCode === 50) {
        e.stopImmediatePropagation();
        placeMarker(false)
    }
    if (e.keyCode === 51) {
        e.stopImmediatePropagation();
        mapsFromCoords(false)
    }
}

document.addEventListener("keydown", onKeyDown);
