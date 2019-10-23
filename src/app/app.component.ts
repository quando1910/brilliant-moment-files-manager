import { Component, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from './core/services';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';
const fs = require('fs');
const path = require('path');
const {dialog} = require('electron').remote;
const { COPYFILE_EXCL } = fs.constants;
const glob = require('glob');


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  folder = {
    path: '',
    length: 0,
    total: 0
  };
  statistic = {
    success: 0,
    fail: 0
  };
  folderUpload = {
    path: '',
    total: 0
  };
  result = [];
  listFiles = [];
  listFilterFiles = [];
  workingFiles = [];
  rawFiles = [];
  currentActive = 0;
  DEFAULT_SPLIT_FOLDER = 'raw_upload';
  DEFAULT_MAX_FILES = 5;
  DEFAULT_EXTENSION = /\.(jpe?g|png)$/gi;
  // /\.(jpe?g|png|gif)$/gi

  constructor(
    public electronService: ElectronService,
    private cd: ChangeDetectorRef,
    private translate: TranslateService
  ) {
    translate.setDefaultLang('en');
    console.log('AppConfig', AppConfig);

    if (electronService.isElectron) {
      console.log(process.env);
      console.log('Mode electron');
      console.log('Electron ipcRenderer', electronService.ipcRenderer);
      console.log('NodeJS childProcess', electronService.childProcess);
    } else {
      console.log('1234Mode web');
    }
  }

  filter(ind) {
    switch (ind) {
      case 0:
        this.listFilterFiles = this.listFiles;
        break;
      case 1:
        this.listFilterFiles = this.listFiles.filter(x => x.status);
        break;
      case 2:
        this.listFilterFiles = this.listFiles.filter(x => x.err);
        break;
    }
  }

  pathDir() {
    dialog.showOpenDialog({
      properties: ['openDirectory']
    }).then(data => {
      if (!data.canceled) {
        this.folder.path = data.filePaths[0];
        this.folder.total = 0;
        this.listFiles = [];
        this.countFiles(this.folder.path);
        this.listFilterFiles = this.listFiles;
        this.workingFiles = [...this.listFiles];
      }
    });
  }

  pathUpload() {
    dialog.showOpenDialog({
      properties: ['openDirectory']
    }).then(data => {
      if (!data.canceled) {
        this.folderUpload.path = data.filePaths[0];
        this.folderUpload.total = Math.ceil(this.folder.total / this.DEFAULT_MAX_FILES);
      }
    });
  }

  countFiles(currentPath, extension = this.DEFAULT_EXTENSION) {
    const dirents = fs.readdirSync(currentPath, { withFileTypes: true });
    const folders = dirents
    .filter(dirent => dirent.isDirectory() && !(/(^|\/)\.[^\/\.]/g).test(dirent.name) && dirent.name !== this.DEFAULT_SPLIT_FOLDER)
    .map(x => x.name);
    const files = dirents
      .filter(dirent =>
        !dirent.isDirectory() &&
        new RegExp(extension).test(dirent.name) &&
        !(/(^|\/)\.[^\/\.]/g).test(dirent.name))
      .map(x => (
        {
          path: currentPath,
          name: x.name,
          status: false
        })
      );
    this.folder.total += files.length;
    this.listFiles = [...this.listFiles, ...files];
    if (folders.length > 0) {
      for (let i = 0; i < folders.length; i++) {
        const subPath = path.join(currentPath, folders[i].toString());
        this.countFiles(subPath, extension);
      }
    }
  }

  checkRaw() {
    let countRaw = 0;
    let countFolder = 0;
    this.listFiles = [];
    const pathDir = `${this.folderUpload.path}/${this.DEFAULT_SPLIT_FOLDER}`;

    // get Raw Files extension, assign to listFiles
    this.countFiles(this.folder.path, /\.(cr2|nef|arw)$/gi);
    const rawFiles = [...this.listFiles].map(x => {
      x.shortName = x.name.substr(0, x.name.lastIndexOf('.'));
      return x;
    });
    this.listFiles = [];
    this.countFiles(pathDir);
    const searchFiles = [...this.listFiles];

    if (!fs.existsSync(`${pathDir}/extra_${countFolder}`)) {
      fs.mkdirSync(`${pathDir}/extra_${countFolder}`);
    }

    rawFiles.forEach(raw => {
      const ind = searchFiles.findIndex(x => x.name.includes(raw.shortName));
      if (ind >= 0) {
        if (countRaw === this.DEFAULT_MAX_FILES) {
          countFolder++;
          if (!fs.existsSync(`${pathDir}/extra_${countFolder}`)) {
            fs.mkdirSync(`${pathDir}/extra_${countFolder}`);
          }
          countRaw = 0;
        }
        countRaw++;
        const obj = {
          newPath: `${pathDir}/extra_${countFolder}`,
          name: raw.name,
          err: null,
          status: false };
        fs.copyFile(`${raw.path}/${raw.name}`, `${pathDir}/extra_${countFolder}/${raw.name}`, COPYFILE_EXCL, (err) => {
          if (err) {
            obj.err = err;
          } else {
            obj.status = true;
          }
          this.rawFiles.push(obj);
          this.cd.detectChanges();
        });
      }
    });
  }

  test() {
    console.log(this.listFiles);
    // this.countFiles(this.folderUpload.path, /\.(cr2|nef|arw)$/gi) ;
    glob(`/Users/mba0189/Desktop/CONGTY/raw_upload/_1/_DHQ2785-Edit-2.*`, function (er, files) {
      // files is an array of filenames.
      // If the `nonull` option is set, and nothing
      // was found, then files is ["**/*.js"]
      // er is an error object or null.
      console.log(files);
    });
    // fs.copyFile(
    //   `/Users/mba0189/Desktop/CONGTY/raw_upload/_1/_DHQ2785-Edit-2.jpg`,
    //   `/Users/mba0189/Desktop/CONGTY/raw_upload/_1/_new.png`, COPYFILE_EXCL, (err) => {
    //   console.log(err);
    //   });
  }

  split() {
    const pathDir = `${this.folderUpload.path}/${this.DEFAULT_SPLIT_FOLDER}`;
    const numberOfFolder = Math.ceil(this.folder.total / this.DEFAULT_MAX_FILES);
    if (!fs.existsSync(`${pathDir}`)) {
      fs.mkdirSync(`${pathDir}`);
    }
    for (let i = 0; i < numberOfFolder; i++ ) {
      const subDir = `${pathDir}/_${i + 1}`;
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir);
      }
      const partOfFiles = this.workingFiles.splice(0, this.DEFAULT_MAX_FILES);
      this.result.push({path: `${subDir}`, total: partOfFiles.length});
      for (let j = 0; j < partOfFiles.length; j++ ) {
        fs.copyFile(`${partOfFiles[j].path}/${partOfFiles[j].name}`, `${subDir}/${partOfFiles[j].name}`, COPYFILE_EXCL, (err) => {
          if (err) {
            this.listFiles[i * this.DEFAULT_MAX_FILES + j].err = err;
            this.statistic.fail++;
          } else {
            this.listFiles[i * this.DEFAULT_MAX_FILES + j].status = true;
            this.listFiles[i * this.DEFAULT_MAX_FILES + j].newPath = subDir;
            this.statistic.success++;
          }
          this.cd.detectChanges();
        });
      }
    }
  }

  check() {
    this.listFiles[0].status = true;
  }

}
