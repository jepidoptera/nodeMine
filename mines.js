// var readline = require('readline-sync');
var blessed = require('blessed');

// always know where the mouse is pointing
var mousePos = { x: 0, y: 0 };

// track flagged mines, unflagged mines, and flags
var flags = 0;
var mines = 0;
var unflaggedMines = 0;

// interval to refresh the screen
var frameInterval = null;

// Create a screen object.
var screen = blessed.screen({
    smartCSR: true,
});

screen.title = 'my window title';

// Create a box perfectly centered horizontally and vertically.
var box = blessed.box({
    top: 'center',
    left: 'center',
    width: 33,
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

// Append our box to the screen.
screen.append(box);

// // Add a png icon to the box
// var icon = blessed.image({
//     parent: box,
//     top: 0,
//     left: 0,
//     type: 'overlay',
//     width: 'shrink',
//     height: 'shrink',
//     file: __dirname + '/ball.png',
//     search: false
// });

// generate a map
var mineMap = {
    width: 16,
    height: 16,
    cells: []
};

// the first time the box is clicked, start the game.
box.on('click', startGame);
    
function startGame() {
    // generate new map
    mineMap.cells = generateMineMap(16, 16, 40);

    // reset click function
    box.off('click');
    box.on('click', (event) => {
        // either clear or flag, depending on the button
        if (event.button == "left") {
            clickMine();
        }
        else if (event.button == "right") {
            flagMine();
        }
    });

    // set up the render loop @ 33 fps
    if (!frameInterval) frameInterval = setInterval(() => {
        displayMap(mineMap);
        // Render the screen.
        screen.render();
    }, 33);
};

// track mouse
box.on("mousemove", function (mouse) {
    let x = mouse.x - box.left - 1;
    // only change mouse x when they hover of over a cell, not a line
    if (x % 2 === 0) mousePos.x = x / 2;
    mousePos.y = mouse.y - box.top - 1;
    infobox.setContent(`mouse position: ${mousePos.x}, ${mousePos.y}`)
});

// Create a box in the upper left corner
var infobox = blessed.box({
    top: 0,
    left: 0,
    width: 32,
    height: 3,
    content: `mouse position: ${mousePos.x}, ${mousePos.y}`,
    tags: true,
    border: {
        type: 'line'
    },
    style: {
        bg: 'white',
        fg: 'black'
        // border: {
        //     fg: '#f0f0f0'
        // },
        // hover: {
        //     bg: 'green'
        // }
    }
});

screen.append(infobox);

// // If box is focused, handle `enter`/`return` and give us some more content.
box.key('r', function (ch, key) {
    // regenerate map
    mineMap.cells = generateMineMap(16, 16, 40);
});

// you can also flag with the 'f' key
box.key('f', () => flagMine());

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function (ch, key) {
    console.log(box.left, box.top);
    return process.exit(0);
});

// Focus our element.
box.focus();
// initial screen render
screen.render();

function clickMine(x = mousePos.x, y = mousePos.y) {
    // infobox.width = "100%"; infobox.height = "100%";
    // infobox.setContent(x);
    // return;
    mineMap.cells[x][y].discovered = true;
    if (mineMap.cells[x][y].flagged) {
        // nothing happened when you click on a flagged square
        return;
    }
    // did they click on a mine?
    else if (mineMap.cells[x][y].isMine) {
        // lose the game, reveal the map
        for (let x = 0; x < mineMap.width; x++) {
            for (let y = 0; y < mineMap.height; y++) {
                mineMap.cells[x][y].discovered = true;
            }
        }
        // next click starts over
        box.off('click');
        box.on('click', startGame);
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
    mineMap.cells[x][y].flagged = !mineMap.cells[x][y].flagged;
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
            if (x === mousePos.x && y === mousePos.y) mine = false;
            // set "isMine" property
            map[x].push({ isMine: mine });
            // decrement remaining mines
            if (mine) minesLeft--;
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
    let mapString = "{underline}";
    for (let y = 0; y < map.height; y++) {
        // one row per line
        let mapRow = "";
        for (let x = 0; x < map.width; x++) {
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
                    '',
                    'blue',
                    '#008800',
                    'red',
                    '#880088',
                    '#880000',
                    '#00bbbb',
                    'black',
                    'gray']
                    // traditional minesweeper colors :)
                    [map.cells[x][y].number];   
                // build the display string
                if (color) {
                    mapRow += `{${color}-fg}${(map.cells[x][y].number).toString()}{/${color}-fg}`;
                }
                else {
                    mapRow += `{gray-fg}█{/gray-fg}`;
                }
            }
            // do a mid-line if this isn't the final column
            if (x < map.width - 1) {
                mapRow += "|";
            }
        }
        // and finish it with a newline
        mapString += mapRow + "\n";
    }
    // close off the underline
    mapString += "{/underline}";
    box.setContent(mapString);
}