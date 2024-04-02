import fs from 'fs';

export const deletePhoto = (path) => {
  fs.unlink(path, (err) => {
    if (err) {
      console.log("Erreur lors de la suppression du fichier");
    }
  });
};
