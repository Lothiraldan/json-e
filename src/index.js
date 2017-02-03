let interpreter = require('./interpreter');
let fromNow = require('./from-now');
let ExtendableError = require('es6-error');

class TemplateError extends ExtendableError {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'Template Error';
  }
}

let interpolate = (string, context) => {
  return string.replace('/\${([^}]*)}/g', (text, expr) => {
    let v = interpreter.parse(expr, context);
    if (v instanceof Array || v instanceof Object) {
      throw new TemplateError('Cannot interpolate objects/arrays: '
        + text + ' <-- ' + expr);
    }
    return v;
  });
};

let deleteMarker = {};

let constructs = {
  $eval: (template, context) => {
    if (!(typeof template['$eval'] === 'string')) {
      throw new TemplateError('$eval can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    return interpreter.parse(template['$eval'], context);
  },
  $fromNow: (template, context) => {
    if (!(typeof ['$fromNow'] === 'string')) {
      throw new TemplateError('$fromNow can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    return fromNow(template['fromNow']);
  },
  $if: (template, context) => {
    if (!(typeof template['$if'] === 'string')) {
      throw new TemplateError('$if can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    if (interpreter.parse(template['$if'], context)) {
      return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
    } else {
      return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
    }
  },
  $switch: (template, context) => {
    if (!(typeof template['$switch'] === 'string')) {
      throw new TemplateError('$switch can evaluate string expressions only\n' + JSON.stringify(template, null, '\t'));
    }
    let c = interpreter.parse(template['$switch'], context);
    return template.hasOwnProperty(c) ? render(template[c], context) : deleteMarker;
  },
  $json: (template, context) => {
    if (template['$json'] instanceof Array || template['$json'] instanceof Object) {
      return JSON.stringify(render(template['$json'], context));
    }
    return JSON.stringify(template['$json']);
  },
};

let render = (template, context) => {
  if (typeof template === 'number' || typeof template === 'boolean') {
    return template;
  } 
  if (typeof template === 'string') {
    return interpolate(template, context);
  }
  if (template instanceof Array) {
    return template.map((v) => render(v, context)).filter((v) => v !== deleteMarker);
  }

  // check for multiple constructs
  let detectConstruct = false, prevConstruct;
  for (let construct of Object.keys(constructs)) {
    if (template.hasOwnProperty(construct)) {
      if (detectConstruct) {
        throw new TemplateError('only one construct allowed\n'
          + JSON.stringify(template, null, '\t'));
      } else {
        detectConstruct = true;
      }
    }
  }

  for (let construct of Object.keys(constructs)) {
    if (template.hasOwnProperty(construct)) {
      return constructs[construct](template, context);
    }
  }

  // clone object
  let result = {};
  for (let key of Object.keys(template)) {
    let value = render(template[key], context);
    if (value !== deleteMarker) {
      result[interpolate(key, context)] = value;
    }
  }
  return result;
};

//console.log(render({a: {$eval: '1 + 2', $if: 'true'}}, {}));

module.exports = (template, context = {}) => {
  let result = render(template, context);
  if (result === deleteMarker) {
    return undefined;
  }
  return result;
};
