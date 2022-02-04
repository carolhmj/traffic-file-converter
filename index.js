// Requires

const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// console.log('args', process.argv);
// 1 - Load the provided traffic simulation file
if (process.argv.length < 3) {
    console.error("No args provided");
    return;
}
const filePath = process.argv[2];

console.log("Reading", filePath);

const results = [];

// Calculate the euclidian distance between two points
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx*dx + dy*dy);
}

fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
        // console.log(results);
        // 2 - Iterate through the provided lines, converting them to the hot routes format
        // the point id will simply be the i index of the line, while the traj id is the id on the line
        const convertedPoints = [];
        // Record data for the trajectory
        const trajRecords = {

            //{ prevPt
            //nPts,
            //accVel,
            // firstPtId
            // interval }
        };
        

        for (let i = 0; i < results.length; i++) {
            const line = results[i];
            const currPoint = {};

            currPoint.t = line.id; // traj id
            currPoint.p = i; // point id
            currPoint.s = line['#time']; // timestamp
            currPoint.c = [line['lastX[pixel]'], line['lastY[pixel]']]; // pixel coordinates
            currPoint.a = -1; // previous point on traj
            currPoint.n = -1; // next point on traj
            currPoint.v = 0; // instantaneous speed

            if (trajRecords[currPoint.t] !== undefined) {
                const prevPoint = trajRecords[currPoint.t].prevPt;

                currPoint.a = prevPoint.p; // update previous point on traj
                prevPoint.n = currPoint.p; // update next point on traj (which is our current point)

                const d = dist(prevPoint.c[0], prevPoint.c[1], currPoint.c[0], currPoint.c[1]);
                prevPoint.d = d; // distance to next point

                const timeDiff = currPoint.s - prevPoint.s;
                const instSpeed = d / timeDiff; // update instantaneous speed

                currPoint.v = instSpeed; 
            } else {
                // This is the first point on the traj
                trajRecords[currPoint.t] = {
                    trajId: currPoint.t,
                    firstPtId: currPoint.p,
                    interval: [currPoint.s, currPoint.s],
                    nPts: 0,
                    accVel: 0
                };
            }

            trajRecords[currPoint.t].prevPt = currPoint;
            trajRecords[currPoint.t].accVel += currPoint.v;
            trajRecords[currPoint.t].nPts += 1;
            trajRecords[currPoint.t].interval[1] = currPoint.s;

            convertedPoints.push(currPoint);
        }

        console.log("Finished converting points");
        // console.log(convertedPoints);

        // 3 - Get the trajectory data from the previous step and convert it to the trajectory format for hot routes
        const resultTrajs = Object.values(trajRecords);
        const convertedTrajs = [];

        for (let j = 0; j < resultTrajs.length; j++) {
            const line = resultTrajs[j];
            const currTraj = {};

            currTraj.t = line.trajId;
            currTraj.p = line.firstPtId;
            currTraj.i = line.interval;
            currTraj.v = line.accVel / line.nPts;

            convertedTrajs.push(currTraj);
        }
        console.log("Finished converting trajs");
        console.log(convertedTrajs);

        // 4 - Write out the converted data to the output
        const baseName = path.basename(filePath, '.txt');
        const pointsOutFilePath = "./out/simPoints_" + baseName + ".js";
        const trajsOutFilePath = "./out/simTrajs_" + baseName + ".js";

        let stringPts = JSON.stringify(convertedPoints);
        stringPts += ";\nvar minTimeStamp = 0;"

        const stringTrajs = JSON.stringify(convertedTrajs);

        fs.writeFile(pointsOutFilePath, stringPts, () => {
            console.log('Wrote points file as', pointsOutFilePath);
        });

        fs.writeFile(trajsOutFilePath, stringTrajs, () => {
            console.log('Wrote trajs out file as', trajsOutFilePath);
        });
    });
