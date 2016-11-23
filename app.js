#! /usr/bin/env node
const _ = require("lodash");
const fs = require("fs");
const touch = require("touch");
const open = require("open");
var program = require("commander");

program
    .version("0.1.0")
    .option("-i, --input [path]", "[path] to the imput JSON file, default is cv.json", "cv.json")
    .option("-o, --output [path]", "[path] to the output HTML file, default is cv.html", "cv.html")
    .parse(process.argv);

const preparePath = (path) => {
    if (!(_.includes(path, "/"))) {
        return `./${path}`;
    }
    return path;
};

const inputFile = preparePath(program.input);
const outputFile = preparePath(program.output);

if (!(fs.existsSync(`${inputFile}`))) {
    throw new Error(`Could not find file: ${inputFile}`);
}

const data = require(inputFile);

const requiredKeys = [
    "htmlTitle",
    "title",
    "date",
    "name",
    "elements"
];

//Check if all required keys are there
//Check if certain keys meet requirements
requiredKeys.map((key, index, self) => {
    if (!(_.includes(Object.keys(data), key))) throw new Error(`JSON must contain top level key: ${key}`);
    if (key === "elements") {
        if (!(data[key].constructor === Array)) throw new Error(`The key "elements" has to be an array`);
    }
});

const createElement = (tag, classList, content) => {
    const cl = classList ? ` class="${classList.join(" ")}"` : "";
    const cnt = contentFactory(content);
    return `<${tag}${cl}>${cnt}</${tag}>`;
};

const contentFactory = (content) => {
    if (typeof content === "string") {
        var re = /\[([^\]]+)\]\(([^)]+)\)/g;
        var matches = [];
        var match = re.exec(content);
        while (match != null) {
            matches.push({
                text: match[1],
                link: match[2],
                full: match[0]
            });
            match = re.exec(content);
        }
        let parsedString = content;
        matches.map((el) => {
            parsedString = parsedString.replace(el.full, createElement(`a href="${el.link}" target="_blank"`, [], el.text));
        });
        return parsedString;
    }
    if (content.constructor === Array) return content.join("");
    if (content && (typeof content === "object") && content.constructor !== Array) {
        if (!Object.hasOwnProperty.call(content, "display")) throw new Error(`Element must have display key.`);
        if (!Object.hasOwnProperty.call(content.display, "payload")) throw new Error(`Display must have payload key`);
        if (_.includes(["ul", "ol", "dl"], content.display.type)) {
            return listElementsCreator(content.display.type, content);
        }
    }
    throw new Error(`${JSON.stringify(content)} is not valid.`);
};

const listElementsCreator = (tag, content) => {
    let ddDtGenerator = function* (){
        let isDt = false;
        while(true) {
            isDt = !isDt;
            isDt ? yield "dt" : yield "dd";
        }
    };
    let ddDtGen = ddDtGenerator();
    const itemCalculator = function (tag) {
        if (tag === "ul") return "li";
        if (tag === "ol") return "li";
        if (tag === "dl") return ddDtGen.next().value;

    };
    if (!(content.display.payload.constructor === Array)) throw new Error(`The key "payload" has to be an array for ul`);
    const liElements = content.display.payload.map((el) => {
        //Group inside list
        if (el && typeof el === "object") {
            //TODO: needs more robustness, should abstract key testing and such
            return createGroup(createElement("h4", ["sub-group"], el.title), el)
        }
        const itemTag = itemCalculator(tag);
        return createElement(itemTag, [], el);
    });
    return createElement(tag, [], liElements);
};

const createRowStruct = (innerClassList, content) => {
    if (arguments < 2) throw new Error("Functions takes two arguments: innerClassList, content");
    //TODO: clean up this function's argument handling
    let innerClass = ["column"];
    innerClassList ? innerClass.push(...innerClassList) : void(0);
    return createElement("div", ["row"], createElement(
        "div", innerClass, content
    ));
};

const createGroup = (title, content) => {
    let output = createRowStruct(null, title);
    output += createRowStruct(["column-offset-10"], content);
    return output;
};



let output =
`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${data.htmlTitle}</title>
    <!-- Google Fonts -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,300italic,700,700italic">
    <!-- CSS Reset -->
    <link rel="stylesheet" href="bower_components/normalize.css/normalize.css">
    <!-- Milligram CSS minified -->
    <link rel="stylesheet" href="bower_components/milligram/dist/milligram.min.css">
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
   <div class="container">
`;


output += createRowStruct(["text-center"], `<h1>${data.title}</h1>`);
output += createRowStruct(["text-center"], `<h2>${data.name}</h2>`);
output += createRowStruct(null, `<h3>${data.date}</h3>`);
data.elements.map((el) => {
    if (!el.type) throw new Error("A type must be defined for an element");
    if (el.type === "group") {
        output += createGroup(createElement("h4", [], el.title), el);
    }
});

output +=
`  
  </div>
</body>
</html>`;

if (fs.existsSync(outputFile)) {
    touch(outputFile);
}

fs.writeFile(outputFile, output, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log(`Done creating the html, your file is named: ${outputFile}`);
    console.log("Use your browser to save it as PDF");
    //open(outputFile);
});



