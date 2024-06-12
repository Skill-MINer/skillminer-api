import fs from "fs";
import path from "path";

const header = 'Timestamp,Method,URL,IP,User Agent\n';
const maxFileSize = 5 * 1024 * 1024; // 5 MB
let logFile = 'request_logs.csv';


export const logger = (req, res, next) => {
  const log = `${new Date().toISOString()},${req.method},${req.originalUrl},${
    req.ip
  },${req.headers["user-agent"]}\n`;
  const safeLogFile = path.basename(logFile);

  fs.stat(safeLogFile, (err, stats) => {
    if (err && err.code === "ENOENT") {
      fs.writeFile(safeLogFile, header + log, (err) => {
        if (err) {
          console.error(err);
        }
      });
    } else if (err) {
      console.error(err);
    } else {
      if (stats.size >= maxFileSize) {
        fs.unlink(safeLogFile, (err) => {
          if (err) {
            console.error(err);
          } else {
            fs.writeFile(safeLogFile, header, (err) => {
              if (err) {
                console.error(err);
              }
            });
          }
        });
      } else {
        fs.appendFile(safeLogFile, log, (err) => {
          if (err) {
            console.error(err);
          }
        });
      }
    }
  });

  next();
};
