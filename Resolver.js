// ==UserScript==
// @name         Geoguessr Resolver (dev)
// @namespace    http://tampermonkey.net/
// @version      10.0b
// @description  Features: Automatically score 5000 Points | Score randomly between 4500 and 5000 points | Open in Google Maps | See enemy guess Distance
// @author       0x978
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        none
// ==/UserScript==

window.alert = function (message) { // Devs tried to overwrite alert to detect script. I had already stopped using alert, but i'd rather they didn't override this anyway.
    nativeAlert(message)
};

const originalFetch = window.fetch;
window.fetch = function (url, options) {
    if (url === "https://www.geoguessr.com/api/v4/cd0d1298-a3aa-4bd0-be09-ccf513ad14b1") { // devs using this endpoint for Anticheat. Block all calls to it.
        return
    }
    return originalFetch.call(this, url, options);
};

async function getAddress(lat, lon) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
    return await response.json();
}

function displayLocationInfo() {
    const coordinates = getUserCoordinates()
    // api call with the lat lon to retrieve data.
    getAddress(coordinates[0], coordinates[1]).then(data => {
        alert(`
        Country: ${data.address.country}
        County: ${data.address.county}
        City: ${data.address.city}
        Road: ${data.address.road}
        State: ${data.address.state}
        Postcode: ${data.address.postcode}
        Village/Suburb: ${(data.address.village || data.address.suburb)}

       Postal Address: ${data.display_name}
        `)
    });

}

function placeMarker(safeMode, skipGet, coords) {

    let [lat, lng] = skipGet ? coords : getUserCoordinates()
    if (document.getElementsByClassName("guess-map__canvas-container")[0] === undefined) { // if this is not defined, the user must be in a streaks game, streaks mode uses a different map and therefore is calculated in a different function
        if(document.getElementsByClassName("region-map_map__7jxcD")[0]){
            placeMarkerStreaksMode([lat, lng])
        }
        else{
            panicPlaceCoords()
        }
        return;
    }

    if (safeMode) {
        lat += (Math.random() / 2);
        lng += (Math.random() / 2);
    }

    const element = document.getElementsByClassName("guess-map__canvas-container")[0] // html element containing needed props.
    const keys = Object.keys(element) // all keys
    const key = keys.find(key => key.startsWith("__reactFiber$")) // the React key I need to access props
    const place = element[key].return.memoizedProps.onMarkerLocationChanged // getting the function which will allow me to place a marker on the map

    flag = false;
    place({lat: lat, lng: lng}) // placing the marker on the map at the correct coordinates given by getCoordinates(). Must be passed as an Object.
    toggleClick(({lat: lat, lng: lng}))
    displayDistanceFromCorrect({lat: lat, lng: lng})
    injectOverride()
}

function placeMarkerStreaksMode([lat, lng]) {

    const element = document.getElementsByClassName("region-map_map__7jxcD")[0] // this map is unique to streaks mode, however, is similar to that found in normal modes.
    const keys = Object.keys(element)
    const reactKey = keys.find(key => key.startsWith("__reactFiber$"))
    const placeMarkerFunction = element[reactKey].return.memoizedProps.onRegionSelected // This map works by selecting regions, not exact coordinates on a map, which is handles by the "onRegionSelected" function.

    // the onRegionSelected method of the streaks map doesn't accept an object containing coordinates like the other game-modes.
    // Instead, it accepts the country's 2-digit IBAN country code.
    // For now, I will pass the location coordinates into an API to retrieve the correct Country code, but I believe I can find a way without the API in the future.
    // TODO: find a method without using an API since the API is never guaranteed.

    getAddress(lat, lng).then(data => { // using API to retrieve the country code at the current coordinates.
        const countryCode = data.address.country_code
        placeMarkerFunction(countryCode) // passing the country code into the onRegionSelected method.
    })
}

function panicPlaceCoords(){ // I have no idea what Geoguessr did to hide the new place function so well, but I've figured it out.
    const x = document.getElementsByClassName("coordinate-map_canvasContainer__7d8Yw")[0]
    const keys = Object.keys(x)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = x[key]

    const clickProperty = props.return.memoizedProps.map.__e3_.click
    const dynamicIndex = Object.keys(clickProperty)[0]
    const clickFunction = clickProperty[dynamicIndex].xe

    let coords = panicGetCoords()

    let y = {
        "latLng": {
            "lat": coords.lat,
            "lng": coords.lng,
        }
    }
    clickFunction(y)
    alert("Backup Coordinate Placement Activated: \n \n You MUST move your map marker slightly before submitting your guess. Not doing so will cause your web browser to crash.")
}

function panicGetCoords(){
    const x = document.getElementsByClassName("styles_root__3xbKq")[0]
    const keys = Object.keys(x)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = x[key]
    const found = props.return.memoizedProps.panorama.position
    return found
}

// detects game mode and return appropriate coordinates.
function getUserCoordinates() {

    const x = document.getElementsByClassName("styles_root__3xbKq")[0]
    const keys = Object.keys(x)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = x[key]
    const found = props.return.memoizedProps.panorama.position
    return ([found.lat(), found.lng()]) // lat and lng are functions returning the lat/lng values
}

function mapsFromCoords() { // opens new Google Maps location using coords.
    const [lat, lon] = getUserCoordinates()
    if (!lat || !lon) {
        return;
    }
    window.open(`https://www.google.com/maps/place/${lat},${lon}`);
}

// function matchEnemyGuess(){ broken due to geoguessr AC
//     const enemyGuess = getEnemyGuess()
//     console.log(enemyGuess)
//     let eLat = enemyGuess.lat
//     let eLng = enemyGuess.lng
//     console.log(eLat,eLng)
//     placeMarker(false,true,[eLat,eLng])
// }

function fetchEnemyDistance() { // OUTPUT WILL NEED TO BE ROUNDED IF TO BE DISPLAYED
    const guessDistance = getEnemyGuess()
    if (guessDistance === null) {
        return;
    }
    const km = guessDistance / 1000
    const miles = km * 0.621371
    return [km, miles]
}

function getEnemyGuess() {
    const x = document.getElementsByClassName("game_layout__TO_jf")[0]
    if (!x) {
        return null
    }
    const keys = Object.keys(x)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = x[key]
    const teamArr = props.return.memoizedProps.gameState.teams
    const enemyTeam = findEnemyTeam(teamArr, findID())
    const enemyGuesses = enemyTeam.players[0].guesses
    const recentGuess = enemyGuesses[enemyGuesses.length - 1]

    if (!isRoundValid(props.return.memoizedProps.gameState, enemyGuesses)) {
        return null;
    }
    return recentGuess.distance
}

function findID() {
    const y = document.getElementsByClassName("user-nick_root__DUfvc")[0]
    const keys = Object.keys(y)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = y[key]
    const id = props.return.memoizedProps.userId
    return id
}

function findEnemyTeam(teams, userID) {
    const player0 = teams[0].players[0].playerId
    if (player0 !== userID) {
        return teams[0]
    } else {
        return teams[1]
    }
}

function isRoundValid(gameState, guesses) { // returns true if the given guess occurred in the current round.
    const currentRound = gameState.currentRoundNumber
    const numOfUserGuesses = guesses ? guesses.length : 0;
    return currentRound === numOfUserGuesses
}

function getGuessDistance(manual) {
    const coords = getUserCoordinates()
    const clat = coords[0] * (Math.PI / 180)
    const clng = coords[1] * (Math.PI / 180)
    const y = document.getElementsByClassName("guess-map__canvas-container")[0]
    const keys = Object.keys(y)
    const key = keys.find(key => key.startsWith("__reactFiber$"))
    const props = y[key]
    const user = manual ?? props.return.memoizedProps.markers[0]
    if (!coords || !user) {
        return null
    }
    const ulat = user.lat * (Math.PI / 180)
    const ulng = user.lng * (Math.PI / 180)

    const distance = Math.acos(Math.sin(clat) * Math.sin(ulat) + Math.cos(clat) * Math.cos(ulat) * Math.cos(ulng - clng)) * 6371
    return distance
}

function displayDistanceFromCorrect(manual) {
    let unRoundedDistance = getGuessDistance(manual) // need unrounded distance for precise calculations later.
    let distance = Math.round(unRoundedDistance)
    if (distance === null) {
        return
    }
    let enemy = fetchEnemyDistance(true)
    const BR = getBRGuesses()
    let text = enemy ? `${distance} km  ||  Enemy: ${Math.round(enemy[0])} km || Damage: ${calculateScore(unRoundedDistance,enemy[0])}` : BR !== null ? `${distance} km || Best Enemy Guess: ${BR} km` : `${distance} km (${Math.round(distance * 0.621371)} miles)` // this got pretty hard to read as I added more features
    setGuessButtonText(text)
    //alert(`Your marker is ${distance} km (${Math.round(distance * 0.621371)} miles) away from the correct guess`)
}

function setGuessButtonText(text) {
    let x = Array.from(document.getElementsByClassName("button_wrapper__NkcHZ"))
    if(!x){
        console.log("ERROR: Failed to calculate distance, unable to locate button.")
        return null}
    if((x[x.length-1].innerText).includes("PRO")){
        return
    }
    x[x.length-1].innerText = text
}

function toggleClick(coords) { // prevents user from making 5k guess to prevent bans.
    const disableSpaceBar = (e) => {
        if (e.keyCode === 32) {
            const distance = getGuessDistance()
            if ((distance < 1 || isNaN(distance)) && !flag) {
                e.stopImmediatePropagation();
                preventedActionPopup()
                document.removeEventListener("keyup", disableSpaceBar);
                flag = true
            }
        }
    };
    document.addEventListener("keyup", disableSpaceBar);
    setTimeout(() => {
        const distance = getGuessDistance()
        if ((distance < 1 || isNaN(distance)) && !flag) {
            let old = document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick
            document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick = (() => {
                flag = true
                preventedActionPopup()
                document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0][Object.keys(document.getElementsByClassName("button_button__CnARx button_variantPrimary__xc8Hp")[0])[1]].onClick = (() => old())
            })
        }
    }, 500)
}

function preventedActionPopup() {
    alert(`Geoguessr Resolver has prevented you from making a perfect guess.

    Making perfect guesses will very likely result in a ban from competitive.

    Press "guess" again to proceed anyway.`)
}

function injectOverride() {
    document.getElementsByClassName("guess-map__canvas-container")[0].onpointermove = (() => { // this is called wayyyyy too many times (thousands) but fixes a lot of issues over using onClick.
        displayDistanceFromCorrect()
    })
}

function getBRGuesses() {
    let gameRoot = document.getElementsByClassName("game_root__2vV1H")[0]
    if(!gameRoot){
        return null
    }
    let keys = gameRoot[Object.keys(document.getElementsByClassName("game_root__2vV1H")[0])[0]]
    let gameState = keys.return.memoizedProps.gameState
    let players = gameState.players
    let bestGuessDistance = Number.MAX_SAFE_INTEGER
    players.forEach(player => {
        let currGuess = player.coordinateGuesses[player.coordinateGuesses.length - 1]
        if(currGuess){
            let currDistance = currGuess.distance
            if ((currDistance < bestGuessDistance) && currGuess.roundNumber === gameState.currentRoundNumber && player.playerId !== gameRoot.return.memoizedProps.currentPlayer.playerId) {
                bestGuessDistance = currDistance
            }
        }
    })
    if (bestGuessDistance === Number.MAX_SAFE_INTEGER) {
        return null;
    }
    return Math.round(bestGuessDistance / 1000)
}

function displayBRGuesses(){
    const distance = getBRGuesses()
    if (distance === null) {
        alert("There have been no guesses this round")
        return;
    }
    alert(`The best guess this round is ${distance} km from the correct location. (Not including your guess)`)
}

function calculateScore(Udistance,eDistance){
    let userScore = Math.round(5000*Math.exp((-10*Udistance/14916.862))) // Thank you to this reddit comment for laying out the math so beautifully after I failed to do so myself: https://www.reddit.com/r/geoguessr/comments/zqwgnr/how_the_hell_does_this_game_calculate_damage/j12rjkq/?context=3
    let enemyScore = Math.round(5000*Math.exp((-10*eDistance/14916.862)))
    let damage = (userScore - enemyScore) * getMultiplier()
    //console.log("distances:",Udistance, eDistance, "||", "scores:", userScore, enemyScore, "x:",getMultiplier(), "Damage:",damage)
    return damage
}

function getMultiplier(){
    let obj = document.getElementsByClassName("round-icon_container__bNbtn")[0]
    if(!obj){return 1}
    let prop = obj[Object?.keys(document.getElementsByClassName("round-icon_container__bNbtn")[0])[0]]?.return?.memoizedProps
    return prop?.multiplier ?? 1
}

let onKeyDown = (e) => {
    if (e.keyCode === 49) {
        placeMarker(true, false, undefined)
    }
    if (e.keyCode === 50) {
        placeMarker(false, false, undefined)
    }
    if (e.keyCode === 51) {
        displayLocationInfo()
    }
    if (e.keyCode === 52) {
        mapsFromCoords()
    }
    if (e.keyCode === 53) {
        displayBRGuesses()
    }
}
document.addEventListener("keydown", onKeyDown);
let flag = false

document.getElementsByClassName("header_logo__vV0HK")[0].innerText = `
                Geoguessr Resolver Loaded Successfully

                    Controls (UPDATED!):
                '1': Place marker on a "safe" guess (4500 - 5000)
                '2': Place marker on a "perfect" guess (5000)
                '3': Get a description of the correct location.
                '4': Open location in Google Maps (In a new tab)

                After pressing '1' or '2' Your guess distance and Enemy Guess distance
                is automatically calculated when ever you place a marker on the map`


if (!await GM.getValue("8.4")) {
    GM.setValue("8.4", "true");
    alert(`Geoguessr Resolver has updated to version 8.3:
    <------------------------- Controls are now over there

    Now prevents scoring 5k in duels (to avoid bans). To bypass this, simply press "guess" again.
    Stopped annoying controls popup on each page load. Now, this dialog will appear once per update.
    Added ability to view enemy's guess distance and your guess distance, replaces "submit" button text.
    `)
}
