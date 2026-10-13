//Declaring global variables to be used anywhere in the code
var cardArray
var headerDiv = document.getElementById('headerDiv')
var cardDiv = document.getElementById('cardDiv')
var artDiv = document.getElementById('artDiv')
var randImageTag = document.getElementById('randImageTag')
var guessDiv = document.getElementById('guessDiv')
var guessInput = document.getElementById('guessInput')
var guessButton = document.getElementById('guessButton')
var guessThatHeader = document.getElementById('guessThatHeader')
var typeLineDiv = document.getElementById('typeLineDiv')
var typeLineHeading = document.getElementById('typeLineHeading')
var hintDiv = document.getElementById('hintDiv')
var scoreDiv = document.getElementById('scoreDiv')
var randCardName

//Define content variable that is the div in the body of the page
let content = document.getElementById('content');

//Function that runs when the page loads
window.onload = (event) => {
    guessInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          document.getElementById('guessButton').click();
        }
    });

    //Generate the first card
    randomCard()
};

//Function to grab the card data
async function getRandCardData() {
    //Define the URL we want to get the card from
    const url = 'https://api.scryfall.com/cards/random';
    //Try catch in case the url doesn't work
    try {
        //Grabbing the response from the api
        const response = await fetch(url);

        //If our response message is anything BUT ok
        if (!response.ok) {
            //Log the response status
            throw new Error(`Response status: ${response.status}`);
        }
        
        //Grab the json version of the response and assign it to cardArray variable
        cardArray = await response.json();
    
    //If the page fails to return something
    }   catch (error){
        //Log error message
        console.error(error.message);
    }
};

//Function to get a random card
async function randomCard(){
    //Call the random card function
    await getRandCardData()

    //Output the card to the console
    console.log(cardArray)

    //Check to see if the card has multiple faces
    if(!cardArray['name']){
        //Get a random number for the face of the card
        randomCardFace = getRandomInt(1)
        //Get the name of the random face of the card
        randCardName = cardArray['card_faces'][randomCardFace]['name']
        //Get the art of the random face of the card
        randCardImage = cardArray['card_faces'][randomCardFace]['image_uris']['art_crop']
        //Get the types of the random card face
        randCardTypes = cardArray['card_faces'][randomCardFace]['type_line']
        //Get the artist of the random face of the card
        randCardArtist = cardArray['card_faces'][randomCardFace]['artist']
    }
    else{
        //Get the name of the random card
        randCardName = cardArray['name']
        //Get the art of the random card
        randCardImage = cardArray['image_uris']['art_crop']
        //Get the types of the random card
        randCardTypes = cardArray['type_line']
        //Get the artist of the random card
        randCardArtist = cardArray['artist']
        
    }

    //Set the source of the image to the card image we pulled from the api
    randImageTag.src = randCardImage
    //Set the type line of the types
    typeLineHeading.innerText = randCardTypes
}

//Function to submit and check the guess
function submitGuess(){
    //Normalize the card name to remove accented characters and make it all lowercase
    randCardNameHold = randCardName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').toLowerCase()

    //Normalize the guess given to remove accented characters and make it all lowercase
    guess = guessInput.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').toLowerCase()

    console.log(randCardNameHold)
    console.log(guess)

    console.log(levenshteinDistance(randCardNameHold, guess))

    if(levenshteinDistance(randCardNameHold, guess) == 0){
        if(randCardNameHold == guess){
            //They guessed right!!
            guessDiv.style.backgroundColor = ' #dbffd1';

            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.2 },
            });

            newCardButton.innerText = 'New Card'
            guessInput.disabled = true
            guessButton.disabled = true
            newCardButton.onclick = reset
        }
        else{
            //Guessed wrong
            guessDiv.style.backgroundColor = '#ffd9d1';
            // Add a class that defines an animation
            guessDiv.classList.add('error');
          
            // remove the class after the animation completes
            setTimeout(function() {
                guessDiv.classList.remove('error');
            }, 300);
        }
    }
    else{
        //Guessed wrong
        guessDiv.style.backgroundColor = '#ffd9d1';
        // Add a class that defines an animation
        guessDiv.classList.add('error');
          
        // remove the class after the animation completes
        setTimeout(function() {
            guessDiv.classList.remove('error');
        }, 300);
    }
}

function settingsFunction(){

}

function giveUp(){
    newCardButton.innerText = 'New Card'
    guessDiv.style.backgroundColor = '#ffd9d1';
    guessInput.value = capitalizeFirstLetter(randCardName)
    guessInput.disabled = true
    guessButton.disabled = true
    newCardButton.onclick = reset
}

async function reset(){
    await randomCard()
    guessInput.disabled = false
    guessButton.disabled = false
    guessDiv.style.backgroundColor = 'aliceblue';
    guessInput.value = ''
    newCardButton.innerText = 'Give up'
    newCardButton.onclick = giveUp
}

const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;

    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] =
            i === 0
                ? j
                : Math.min(
                    arr[i - 1][j] + 1,
                    arr[i][j - 1] + 1,
                    arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
                );
        }
    }
    return arr[t.length][s.length];
};

//Function that capitalizes the first letter of a string, just a useful one to have.
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }