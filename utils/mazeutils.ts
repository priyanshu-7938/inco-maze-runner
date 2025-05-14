export function printMazeFromBytes(mazeView: String){
    const bytes = [];
    for (let i = 2; i < mazeView.length; i += 2) {
        bytes.push(parseInt(mazeView.slice(i, i + 2), 16));
    }
    const mazeSize = 9;
    let maze = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(0));
    let counter = 0;
    for (let row = 0; row < mazeSize; row++) {
        for (let col = 0; col < mazeSize; col++) {
            const byte = bytes[counter];
            if (byte === 0x02) {
                maze[row][col] = 2;
            } else if (byte === 0x01) {
                maze[row][col] = 1;
            } else if (byte === 0x00) {
                maze[row][col] = 0;
            } else if (byte === 0x03) {
                maze[row][col] = 3;
            }
            counter++;
        }
    }
    console.log("Maze:");
    // const BLACK = '\x1b[30m'; // Black color
    const GREEN = '\x1b[32m'
    const WHITE = '\x1b[97m'; // White color
    const RED = '\x1b[31m'; // Red color
    const BLUE  = '\x1b[34m'; // Blue color
    const RESET = '\x1b[0m';
    let rowStr = '';
    for (let row = 0; row < mazeSize; row++) {
      let rowStr = '';
      for (let col = 0; col < mazeSize; col++) {
        let value = maze[row][col];
        switch (value) {
          case 1:
            rowStr += `${GREEN}████ ${RESET}`; // Black for 1
            break;
          case 2:
            rowStr += `${WHITE}████ ${RESET}`; // White for 2
            break;
          case 0:
            rowStr += `${RED}████ ${RESET}`;   // Red for 0
            break;
          case 3:
            rowStr += `${BLUE}████ ${RESET}`;
            break;
          default:
            rowStr += ' '; // Space for any other values
        }
      }
      console.log(rowStr+"\n");
    }
}