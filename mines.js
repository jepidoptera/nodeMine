// var readline = require('readline-sync');
var blessed = require('blessed');

// always know where the mouse is pointing
var mousePos = { x: 0, y: 0 };
var debugMouse = false;

// track flagged mines, unflagged mines, flags, start time, and final time
var flags = 0;
var mines = 0;
var unflaggedMines = 0;
var startTime = 0;
var finalTime = 0;
// difficulty
var difficulty = 1;

// has the game been won? intially not, but in general, we should know this
var gameWon = false;
// the game may also have been lost, and we should know that too
var gameLost = false;
// also track whether the game has been started
var gameStarted = false;

// interval to refresh the screen
var frameInterval = null;

// Create a screen object.
var screen = blessed.screen({
    smartCSR: true,
});

screen.title = 'NODESWEEPER';

// Create a box perfectly centered horizontally and vertically
// this is where the game resides.
var mineBox = blessed.box({
    top: 'center',
    left: 'center',
    width: 35,
    height: 18,
    content: '{center}{bold}Nodesweeper!{/bold}!\nclick here to play.{/center}',
    tags: true,
    border: {
        bg: 8
    },
    style: {
        bg: 'white',
        fg: 'black',
        bold: true
    }
});

// Create a box in the upper left corner for game info
var infobox = blessed.box({
    top: 0,
    left: 'center',
    width: 37,
    height: 3,
    tags: true,
    border: {
        type: 'line'
    },
    style: {
        bg: 'white',
        fg: 'black'
    }
});

// Append our boxes to the screen.
screen.append(mineBox);
screen.append(infobox);

// Focus our element.
mineBox.focus();
// initial screen render
screen.render();

// generate a map
var mineMap = {
    width: 16,
    height: 16,
    cells: []
};

// start the game.
startGame();
    
function startGame() {
    // generate map appropriate to difficulty level
    // generate blank map, just so we have something to show
    mineMap.cells = generateMineMap(16, 16, 0);

    mines = 40;

    // reset game variables
    flags = 0;
    unflaggedMines = mines;
    gameWon = false;
    gameLost = false;
    gameStarted = false;

    // reset click function
    mineBox.off('click');
    // next time we click, it will generate the map
    mineBox.on('click', (event) => {

        // generate new map
        mineMap.cells = generateMineMap(16, 16, mines);

        // start the game and the timer
        startTime = Date.now();
        gameStarted = true;

        // click where they clicked
        clickMine(mousePos.x, mousePos.y);

        // reset click function (again)
        mineBox.off('click');

        // now we're actually playing the game
        mineBox.on('click', (event) => {
            // either clear or flag, depending on the button
            if (event.button == "left") {
                clickMine();
            }
            else if (event.button == "right") {
                flagMine();
            }
        });
    });

    // set up the render loop @ 33 fps
    if (!frameInterval) frameInterval = setInterval(() => {
        // display map string
        displayMap(mineMap);
        // show game info
        if (debugMouse) 
            infobox.setContent(infobox.content);
        else if (!gameStarted)
            infobox.setContent("40     0:00");
        else if (!gameWon && !gameLost)
            // update game timer and remaining mines
            infobox.setContent((mines - flags) + "     " +
                (parseInt((Date.now() - startTime) / 1000)) + ":" +
                (parseInt((Date.now() - startTime) / 10) % 100));
        else if (gameLost)
            infobox.setContent((mines - flags) + "  :(");
        else
            infobox.setContent("you win! time: " + finalTime);
        // Render the screen.
        screen.render();
    }, 33);
};

// track mouse
mineBox.on("mousemove", function (mouse) {
    let x = mouse.x - mineBox.left - 1;
    // move to the next cell when the mouse advances onto a line
    // so the cursor "leads" the mouse instead of "following"
    if (x % 2 === 0) {
        let newPosX = Math.floor(mousePos.x + Math.sign(x / 2 - mousePos.x - 0.5));
        // stay in bounds
        if (newPosX < 0 || mousePos.y < 0 || newPosX >= mineMap.cells.length || mousePos.y >= mineMap.cells[0].length) return;
        // but only do that if the new cell we'd be leading into is undiscovered and unflagged
        if (!mineMap.cells[newPosX, mousePos.y].discovered
            && !mineMap.cells[newPosX, mousePos.y].flagged)
            mousePos.x = newPosX
    }
    // when hovering over a cell, move cursor directly to that cell
    else
        // round down
        mousePos.x = Math.floor(x / 2);
    mousePos.y = mouse.y - mineBox.top - 1;
    infobox.setContent(`mouse position: ${x / 2}, ${mousePos.y}`);
});

// hotkey to reset game (r + s)
mineBox.key("r", function() {
    // mineBox.key('s', function (ch, key) {
        // regenerate map
    startGame();
        // });
})
// mineBox.removeKey("r", function () {
//     mineBox.unkey("s");
// })

// you can also flag with the 'f' key
// because macbooks don't seem to register a right-click with the terminal
mineBox.key('f', () => flagMine());

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function (ch, key) {
    return process.exit(0);
});

// left-clicking on a cell - a risky but necessary move
function clickMine(x = mousePos.x, y = mousePos.y) {
    if (mineMap.cells[x][y].flagged) {
        // nothing happened when you click on a flagged square
        return;
    }
    // "discover" this cell
    mineMap.cells[x][y].discovered = true;
    // now, what did they click on?
    // did they click on a mine?
    if (mineMap.cells[x][y].isMine) {
        lose();
    }
    // or did they click on a blank spot?
    else if (mineMap.cells[x][y].number === 0) {
        // reveal all adjacent squares
        let neighbors = nodeNeighbors(x, y, mineMap.width, mineMap.height);
        neighbors.forEach(n => {
            // if it hasn't been discovered already....
            if (!mineMap.cells[n.x][n.y].discovered) {
                // click it
                clickMine(n.x, n.y);
            }
        })
    }
}

// flag or unflag
function flagMine(x = mousePos.x, y = mousePos.y) {
    // you can't flag a square which is already revealed
    if (mineMap.cells[x][y].discovered) return;
    if (!mineMap.cells[x][y].flagged) {
        // place flag
        mineMap.cells[x][y].flagged = true;
        flags += 1;
        if (mineMap.cells[x][y].isMine) {
            // successfully flagged a mine. one flag closer to winning
            unflaggedMines--;
        }
    }
    else {
        // remove flag
        mineMap.cells[x][y].flagged = false;
        flags -= 1;
        // un-flagged an actual mine.  victory recedes from view
        unflaggedMines++;
    }
    if (unflaggedMines === 0) {
        // victory condition achieved :)!!!
        win();
    }
}

// win the game
function win() {
    gameWon = true;
    // calculate final time
    finalTime = (parseInt((Date.now() - startTime) / 1000)) + ":" +
        (parseInt((Date.now() - startTime) / 10) % 100);
    // next click starts over
    mineBox.off('click');
    mineBox.on('click', startGame);
}

// lose the game
function lose() {
    gameLost = true;
    // reveal the map
    for (let x = 0; x < mineMap.width; x++) {
        for (let y = 0; y < mineMap.height; y++) {
            mineMap.cells[x][y].discovered = true;
        }
    }
    // next click starts over
    mineBox.off('click');
    mineBox.on('click', startGame);
}

// generating a map of the specified diemensions, 
// with the specified number of mines in random positions
function generateMineMap(width, height, mines) {
    let map = [];
    let minesLeft = mines;
    let totalSize = width * height;
    for (let x = 0; x < width; x++) {
        // add another column to the map
        map.push([]);
        for (let y = 0; y < height; y++) {
            let squaresLeft = totalSize - (x * height + y);
            // randomly determine whether to put a mine here
            let mine = Math.floor(Math.random() * squaresLeft) < minesLeft;
            // never place a mine where the player first clicked, or they would lose immediately
            // which is annoying
            if (x === mousePos.x && y === mousePos.y) {
                mine = false;
            }
            // this technically allows a very minor exploit where by clicking on the very last
            // bottom-right cell, a player can *sometimes* start the game with *one* less mine
            // but who cares. so forget that, and
            // set "isMine" property
            map[x].push({ isMine: mine });
            // decrement remaining mines
            if (mine) minesLeft--;
        }
    }
    // ok fine, let's make 100% sure there are as many mines as there should be
    while (minesLeft > 0) {
        let x = Math.floor(Math.random() * width);
        let y = Math.floor(Math.random() * height);
        // and still, we don't want any mines where the player has clicked
        if (!map[x][y].isMine && (x !== mousePos.x || y !== mousePos.y)) {
            map[x][y].isMine = true;
            --minesLeft;
        }
    }
    // count adjacent mines for each cell
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            // get the set of all valid neighbors
            let neighbors = nodeNeighbors(x, y, width, height);
            // count the mines at those map coordinates
            let totalMines = neighbors.reduce((sum, n) => {
                return sum + (map[n.x][n.y].isMine ? 1 : 0);
            }, 0);
            // give this square a number according to how many mines are adjacent
            map[x][y].number = totalMines;
        }
    }
    return map;
}

// return a list of coordinates containing all valid neighbors of this location
function nodeNeighbors(x, y, width, height) {
    let returnVal = [];
    if (x > 0) returnVal.push({ x: x - 1, y: y });
    if (y > 0) returnVal.push({ x: x, y: y - 1 });
    if (x < width - 1) returnVal.push({ x: x + 1, y: y });
    if (y < height - 1) returnVal.push({ x: x, y: y + 1 });
    if (x > 0 && y > 0) returnVal.push({ x: x - 1, y: y - 1});
    if (x > 0 && y < height - 1) returnVal.push({ x: x - 1, y: y + 1 });
    if (x < width - 1 && y > 0) returnVal.push({ x: x + 1, y: y - 1 });
    if (x < width - 1 && y < height - 1) returnVal.push({ x: x + 1, y: y + 1 });
    return returnVal;
}

// build rows of strings indicating mines and stuff
// when finished, set box's content to that string
function displayMap(map) {
    let mapString = "{underline}{gray-fg}";
    for (let y = 0; y < map.height; y++) {
        // one row per line
        let mapRow = "▌{/gray-fg}{black-fg}";
        for (let x = 0; x < map.width; x++) {
            // inter-column line
            if (x > 0) mapRow += "│";
            // highlight the spot where the mouse is
            if (!map.cells[x][y].discovered) {
                if (map.cells[x][y].flagged) {
                    // show a flag
                    mapRow += "{red-fg}►{/red-fg}";
                }
                else if (x == mousePos.x && y == mousePos.y) {
                    mapRow += "{white-fg}{black-bg} {/black-bg}{/white-fg}";
                }
                else {
                    mapRow += " ";
                }
            }
            else if (map.cells[x][y].isMine) {
                // there is a mine here
                if (map.cells[x][y].flagged) {
                    // it has been correctly flagged
                    mapRow += `{red-fg}►{/red-fg}`
                }
                else {
                    // no flag
                    mapRow += '{white-fg}{black-bg}*{/black-bg}{/white-fg}';
                }
            }
            else if (map.cells[x][y].flagged) {
                // a mine has been falsely flagged
                mapRow += `{bold}{white-fg}{red-bg}X{/red-bg}{/white-fg}{/bold}`;
            }
            else {
                // show number of adjacent mines
                let color = [
                    // traditional minesweeper colors :)
                    '',
                    'blue',
                    '#008800', // dark green
                    'red',
                    '#880088', // purple/dark fuscia
                    '#880000', // maroon
                    '#00bbbb', // teal
                    'black',
                    'gray']
                    // choose the one corresponding to the number
                    [map.cells[x][y].number];   
                // build the display string
                if (color) {
                    mapRow += `{${color}-fg}${(map.cells[x][y].number).toString()}{/${color}-fg}`;
                }
                else {
                    // gray block for 0 mines
                    mapRow += `{gray-fg}█{/gray-fg}`;
                }
            }
        }
        // and finish it with a vertical line plus a newline
        mapString += mapRow + "{/black-fg}{gray-fg}▐\n";
    }
    // close off the underline
    mapString += "{/underline}";
    // set box content
    mineBox.setContent(mapString);
}