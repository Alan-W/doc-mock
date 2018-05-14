const chalk = require('chalk'),
	  blue = require("bluebird"),
	  fs = blue.promisifyAll(require("fs")),
	  mkdirp = require('mkdirp'),
	  _ = require('underscore'),
	  jsonFormat = require('json-format');

const doclevernode = require('doclever-node-plugin-xin');
let basepath = __dirname,
	serverFile = "",
	serverText = [],
	namespace = '',
	docLeverConf = {};
	task = 0,
	num = {
		total: 0,
		error: 0,
		ok: 0
	};


//获取docLever数据
function getData() {
	doclevernode.queryDocLeverModel((err, result) => {
		if (result && result.code == 200) {
			console.log(chalk.bgGreen('DOCLever 数据获取成功'));
			// page 和 api
			// console.log('获取到的mock 数据是: ---- ', result.data);
			const mockData = _.groupBy(result.data, (inter) => {
				return (inter.istemp && (inter.istemp == 1) ? 'page' : 'api');
			})

			// 生成test相应的api&page文件夹
			// page 类型的需要生成两中类型的文件: 根据url生成相当于api的文件夹，根据remark生成page文件夹
			loopFilePath(mockData);

		} else {

			console.log(chalk.bgRed('DOCLever 数据获取失败: --- ', err));
		}
	});
}

// 遍历目录
const loopFilePath = function (data = null) {
	const interfaceList = data,
		  pageList = interfaceList.page || [],
		  apiList = interfaceList.api || [];
	task = pageList.length + apiList.length;
	// 生成page 相关文件夹
	_.each(pageList, page => mkFolder(page.tempath, page));

	// 生成 api 相关文件夹
	_.each(apiList, api => mkFolder(api.url, api));
}

// 生成文件夹
const mkFolder = function (path, interfaceItem) {
	let urlArray = path.split('/'),
		filepath = basepath,
		jsonName = urlArray.pop().replace('.tpl', '');

	jsonName += '.json';
	urlArray = _.filter(urlArray, (url) => {
		return url.length !== 0;
	});
	filepath += urlArray.join('/');
	filepath = (filepath.substr(-1, 1) === '/') ? filepath.substr(0, filepath.length - 1) : filepath;

	mkdirp(filepath, (err) => {
		if (err) {
			console.log(chalk.red(`生成目录失败: ${filepath},  ${err}`))
		} else {
			const jsonPath = filepath + '/' + jsonName;
			mkInterfaceJSON(jsonPath, interfaceItem, () => {
				if (task === 0) {
					saveServer();
				}
			});
		}
	})
}

// 写入接口的json文件
const mkInterfaceJSON = function(jsonPath, interfaceItem, callback) {
	// const respDataType = interfaceItem.param[0].outInfo.jsonType,
	const lastVersionInterface = interfaceItem.param[interfaceItem.param.length - 1];
	const formatedData = lastVersionInterface.outParam ? lastVersionInterface.outParam : (lastVersionInterface.outInfo && lastVersionInterface.outInfo.jsonType == 0 ? {} : []);
	try {
		num.total++;
		let _setState = setServer(interfaceItem);
		if (!_setState.run) {
			num.error++;
			task--;
			callback();
			console.log(
				chalk.redBright(
					num.error + "、 生成失败,  接口位置: " +
					interfaceItem.group.name + "/" + interfaceItem.name + "  error： "  +
					chalk.red(_setState)
				)
			);
		} else {
			fs.writeFile(jsonPath, jsonFormat(formatedData), (err) => {
				task--;
				if (err) {
					console.log(chalk.red(`${jsonPath} 写入失败: -- `, err));
					num.error++;
				} else {
					num.ok++;
					_setState.run();
					console.log(
						chalk.yellow(
							num.ok + "、 生成成功，已写入文件: " +
							chalk.green(jsonPath.replace(basepath, '/')) +
							'\n'
						)
					);
				}
				callback();
			});
		}
	} catch (err) {
		console.log('mkInterfaceJSON catch err: --- ', err);
		return false;
	}
}

/*
**  数据类型
	type0: value, // string
	type1: value, // number
	type2: value, // boolean
	type3: value.data, // object item in an array
	type4: value.data, // an object
	type5: null || undefined
*/

// 格式化mock 数据
function toFormatData(data, dataType) {
	const returnData = (dataType === 1 || dataType === 3) ? [] : {};
	try {
		if (dataType === 1 || dataType === 3) { // 整体返回的格式需要是个数组
			_.each(data, (item) => {
				if (item.type === 4) { // 证明这个值是对象， 这个时候item的值需要转换为一个对象
					let obj = convertObjData(item.data);
					returnData.push(obj);
				} else if (item.type === 3) {
					let arrayItem = convertArrayData(item.data);
					returnData.push(arrayItem);
				} else returnData.push(item.mock);
			})

		} else { // 整体返回的格式是个对象就可以，这个时候每个item 必须是有name 的
			_.each(data, (item) => {
				if (!item.name) {
					console.log(chalk.red('mock 数据有错， 对象缺少key 字段'));
					return false;
				}
				let valueData = item.data || item.mock;
				if (item.type === 4) { // 证明这个值是对象， 这个时候valueData返回的是一个对象
					valueData = convertObjData(item.data);
				} else if (item.type === 3) {
					valueData = convertArrayData(item.data);
				}
				returnData[item.name] = valueData;
			})
		}

	} catch (err) {
		console.log('接口数据有错误，请检查:-- ', err);
	}
	return returnData;
}

// 返回obj数据
function convertObjData(data, parentObj = {}) {
	let pObj = parentObj;
	_.each(data, (item) => {
		let newData = item.data || item.mock;
		if (item.data) {
			newData = toFormatData(item.data, item.type)
		}
		pObj[item.name] = newData || item.mock;
	})
	return pObj;
}

// 返回array 数据
function convertArrayData(data, parentArray = []) {
	let pArray = [];
	_.each(data, (item) => {
		let newData = item.data || item.mock;
		if (item.data) {
			newData = toFormatData(item.data, item.type)
		}
		pArray.push(newData);
    });
    return pArray;
}


//生成一个server.conf配置
function setServer(action) {
	let line = findServer(action.id),
		ocmd = line !== false ? serverText[line] : '',
		ncmd = {};

	if (action.istemp == 1) { // 页面
		ncmd.tag = 'template';
		ncmd.file = namespace + action.tempath;
		if (!action.tempath) {
			return '模板地址不能为空';
		}
		if (action.tempath.substr(0, 1) != "/") {
			return '模板地址不是以 / 开头';
		}
		if (action.tempath.indexOf("/page/") != 0 && action.tempath.indexOf("/views/") != 0) {
			return '模板地址要从‘/page’开始写，前面不能加项目名';
		}
	} else {
		ncmd.tag = 'rewrite';
		ncmd.file = 'test/' + namespace + action.url + '.json';
	}
	if (!action.url) {
		return '接口 url 为空';
	}
	if (action.url.substr(0, 1) != "/") {
		return '接口 url 不是以 / 开头';
	}
	if (action.url.substr(-1, 1) === "/") {
		return '接口url结尾不能是 ‘/’ ';
	}
	ncmd.url = action.url.replace(/([\/\\.?#=&+*])/g, '\\$1');
	ncmd.url = '^' + ncmd.url + '(\\?|$)'
	ncmd.str = ncmd.tag + ' ' + ncmd.url + ' ' + ncmd.file;

	return {
		run: function() {
			if (line) {
				serverText[line] = ncmd.str;
			} else {
				serverText.push('#@id=' + action._id + '，' + action.name + (action.remark ? '，' + action.remark : ''));
				serverText.push(ncmd.str + '\r\n');
			}
			return true;
		}
	};
}

//查找一个server.conf配置
function findServer(id) {
	var rid = new RegExp('^\#\@id=' + id + '([\\D].*)?$', 'g');
	for (var i = 0; i < serverText.length; i++) {
		if (rid.test(serverText[i])) {
			return i + 1;
		}
	}
	return false;
}

//保存server.conf
function saveServer() {
	fs.writeFileSync(serverFile, serverText.join('\r\n'));
	console.log(chalk.blue("\n========================================================================="));
	console.log(chalk.blue('= 生成完成，总共读取接口' + num.total + "个，成功" + (num.total- num.error) + "个，失败" + num.error + "个，失败率：" + (num.error / num.total * 100).toFixed(2) + "%\t="));
	num.error && console.log(chalk.yellow("= 请检查并修复docLever中的错误，确保Mock生成失败率为0，必要时请求后端协助。  ="));
	console.log(chalk.blue("=========================================================================\n"));
}

module.exports = function (conf, path) {
	docLeverConf = conf;
	doclevernode.config(conf);
	basepath = path + '/';
	namespace = conf.namespace;
	serverFile = path.replace(/[^\/\\]*$/g, '') + 'server.conf';
	getData();
	return doclevernode;
};