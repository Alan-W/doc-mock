doc-mock
===============

nodejs plugin for mocking data from doclever

## 安装

`npm install doc-mock --save`

## 使用

```js
let initMock = require('doc-mock');

initMock({
  host: "apidev.xin.com", // doclever 的域名
  port: '80', // 端口，默认是80
  projectId: "5ab3213b5d30311201b752bc", // 该项目在doclever 上的ID，格式为ObjectId
  namespace: ''  // 命名空间: 一般是项目的名称
}, __dirname + "/../test"); // 本地存放项目接口数据的文件夹

```

## 说明

- initMock函数内调用了包内getData(), 从doclever获取项目接口数据
- 将获取到的项目接口数据转化后，以接口分组名称作为文件夹名称，以接口名称为json文件名依次写入项目的test文件夹内，并将所有生成成功的接口信息写入根目录下的server.conf