import{createRequire as __cr}from 'module';const require=__cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/commander/lib/error.js
var require_error = __commonJS({
  "node_modules/commander/lib/error.js"(exports) {
    var CommanderError2 = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError2 = class extends CommanderError2 {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
  }
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "node_modules/commander/lib/argument.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Argument2 = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.length > 3 && this._name.slice(-3) === "...") {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports.Argument = Argument2;
    exports.humanReadableArgName = humanReadableArgName;
  }
});

// node_modules/commander/lib/help.js
var require_help = __commonJS({
  "node_modules/commander/lib/help.js"(exports) {
    var { humanReadableArgName } = require_argument();
    var Help2 = class {
      constructor() {
        this.helpWidth = void 0;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions) return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(max, helper.subcommandTerm(command).length);
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(max, helper.optionTerm(option).length);
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(max, helper.argumentTerm(argument).length);
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          return `${option.description} (${extraInfo.join(", ")})`;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescripton = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescripton}`;
          }
          return extraDescripton;
        }
        return argument.description;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth || 80;
        const itemIndentWidth = 2;
        const itemSeparatorWidth = 2;
        function formatItem(term, description) {
          if (description) {
            const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
            return helper.wrap(
              fullText,
              helpWidth - itemIndentWidth,
              termWidth + itemSeparatorWidth
            );
          }
          return term;
        }
        function formatList(textArray) {
          return textArray.join("\n").replace(/^/gm, " ".repeat(itemIndentWidth));
        }
        let output = [`Usage: ${helper.commandUsage(cmd)}`, ""];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.wrap(commandDescription, helpWidth, 0),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return formatItem(
            helper.argumentTerm(argument),
            helper.argumentDescription(argument)
          );
        });
        if (argumentList.length > 0) {
          output = output.concat(["Arguments:", formatList(argumentList), ""]);
        }
        const optionList = helper.visibleOptions(cmd).map((option) => {
          return formatItem(
            helper.optionTerm(option),
            helper.optionDescription(option)
          );
        });
        if (optionList.length > 0) {
          output = output.concat(["Options:", formatList(optionList), ""]);
        }
        if (this.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return formatItem(
              helper.optionTerm(option),
              helper.optionDescription(option)
            );
          });
          if (globalOptionList.length > 0) {
            output = output.concat([
              "Global Options:",
              formatList(globalOptionList),
              ""
            ]);
          }
        }
        const commandList = helper.visibleCommands(cmd).map((cmd2) => {
          return formatItem(
            helper.subcommandTerm(cmd2),
            helper.subcommandDescription(cmd2)
          );
        });
        if (commandList.length > 0) {
          output = output.concat(["Commands:", formatList(commandList), ""]);
        }
        return output.join("\n");
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Wrap the given string to width characters per line, with lines after the first indented.
       * Do not wrap if insufficient room for wrapping (minColumnWidth), or string is manually formatted.
       *
       * @param {string} str
       * @param {number} width
       * @param {number} indent
       * @param {number} [minColumnWidth=40]
       * @return {string}
       *
       */
      wrap(str, width, indent, minColumnWidth = 40) {
        const indents = " \\f\\t\\v\xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF";
        const manualIndent = new RegExp(`[\\n][${indents}]+`);
        if (str.match(manualIndent)) return str;
        const columnWidth = width - indent;
        if (columnWidth < minColumnWidth) return str;
        const leadingStr = str.slice(0, indent);
        const columnText = str.slice(indent).replace("\r\n", "\n");
        const indentString = " ".repeat(indent);
        const zeroWidthSpace = "\u200B";
        const breaks = `\\s${zeroWidthSpace}`;
        const regex = new RegExp(
          `
|.{1,${columnWidth - 1}}([${breaks}]|$)|[^${breaks}]+?([${breaks}]|$)`,
          "g"
        );
        const lines = columnText.match(regex) || [];
        return leadingStr + lines.map((line, i) => {
          if (line === "\n") return "";
          return (i > 0 ? indentString : "") + line.trimEnd();
        }).join("\n");
      }
    };
    exports.Help = Help2;
  }
});

// node_modules/commander/lib/option.js
var require_option = __commonJS({
  "node_modules/commander/lib/option.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Option2 = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _concatValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        return previous.concat(value);
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._concatValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as a object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey)) return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str) {
      return str.split("-").reduce((str2, word) => {
        return str2 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const flagParts = flags.split(/[ |,]+/);
      if (flagParts.length > 1 && !/^[[<]/.test(flagParts[1]))
        shortFlag = flagParts.shift();
      longFlag = flagParts.shift();
      if (!shortFlag && /^-[^-]$/.test(longFlag)) {
        shortFlag = longFlag;
        longFlag = void 0;
      }
      return { shortFlag, longFlag };
    }
    exports.Option = Option2;
    exports.DualOptions = DualOptions;
  }
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "node_modules/commander/lib/suggestSimilar.js"(exports) {
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0) return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1) return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports.suggestSimilar = suggestSimilar;
  }
});

// node_modules/commander/lib/command.js
var require_command = __commonJS({
  "node_modules/commander/lib/command.js"(exports) {
    var EventEmitter = __require("node:events").EventEmitter;
    var childProcess = __require("node:child_process");
    var path = __require("node:path");
    var fs = __require("node:fs");
    var process2 = __require("node:process");
    var { Argument: Argument2, humanReadableArgName } = require_argument();
    var { CommanderError: CommanderError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class _Command extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = true;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._outputConfiguration = {
          writeOut: (str) => process2.stdout.write(str),
          writeErr: (str) => process2.stderr.write(str),
          getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
          getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
          outputError: (str, write) => write(str)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args) cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc) return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new _Command(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help2(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0) return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // functions to change where being written, stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // matching functions to specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // functions based on what is being written out
       *     outputError(str, write) // used for displaying errors, and not used for displaying help
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0) return this._outputConfiguration;
        Object.assign(this._outputConfiguration, configuration);
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden) cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument2(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [fn] - custom argument processing function
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, fn, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof fn === "function") {
          argument.default(defaultValue).argParser(fn);
        } else {
          argument.default(fn);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument && previousArgument.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          return this;
        }
        enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs) helpCommand.arguments(helpArgs);
        if (helpDescription) helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err) => {
            if (err.code !== "commander.executeSubCommandAsync") {
              throw err;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError2(exitCode, code, message));
        }
        process2.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option2(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err) {
          if (err.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err.message}`;
            this.error(message, { exitCode: err.exitCode, code: err.code });
          }
          throw err;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._concatValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option2) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('-p, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process2.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process2.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process2.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process2.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path.resolve(baseDir, baseName);
          if (fs.existsSync(localBin)) return localBin;
          if (sourceExt.includes(path.extname(baseName))) return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs.existsSync(`${localBin}${ext}`)
          );
          if (foundExt) return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs.realpathSync(this._scriptPath);
          } catch (err) {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path.resolve(
            path.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path.basename(
              this._scriptPath,
              path.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path.extname(executableFile));
        let proc;
        if (process2.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process2.execArgv).concat(args);
            proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process2.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process2.exit(code);
          } else {
            exitCallback(
              new CommanderError2(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err) => {
          if (err.code === "ENOENT") {
            const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
            const executableMissing = `'${executableFile}' does not exist
 - if '${subcommand._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
            throw new Error(executableMissing);
          } else if (err.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process2.exit(1);
          } else {
            const wrappedError = new CommanderError2(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand) this.help({ error: true });
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise && promise.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent && this.parent.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name) return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} argv
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(argv) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        const args = argv.slice();
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        let activeVariadicOption = null;
        while (args.length) {
          const arg = args.shift();
          if (arg === "--") {
            if (dest === unknown) dest.push(arg);
            dest.push(...args);
            break;
          }
          if (activeVariadicOption && !maybeOption(arg)) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args.shift();
                if (value === void 0) this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (args.length > 0 && !maybeOption(args[0])) {
                  value = args.shift();
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                args.unshift(`-${arg.slice(2)}`);
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (maybeOption(arg)) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              if (args.length > 0) unknown.push(...args);
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg);
              if (args.length > 0) operands.push(...args);
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg);
              if (args.length > 0) unknown.push(...args);
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg);
            if (args.length > 0) dest.push(...args);
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process2.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption) return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments) return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str, flags, description) {
        if (str === void 0) return this._version;
        this._version = str;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str}
`);
          this._exit(0, "commander.version", str);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str, argsDescription) {
        if (str === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str) {
        if (str === void 0) return this._summary;
        this._summary = str;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0) return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases) {
        if (aliases === void 0) return this._aliases;
        aliases.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str) {
        if (str === void 0) {
          if (this._usage) return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str) {
        if (str === void 0) return this._name;
        this._name = str;
        return this;
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path.basename(filename, path.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path2) {
        if (path2 === void 0) return this._executableDir;
        this._executableDir = path2;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        if (helper.helpWidth === void 0) {
          helper.helpWidth = contextOptions && contextOptions.error ? this._outputConfiguration.getErrHelpWidth() : this._outputConfiguration.getOutHelpWidth();
        }
        return helper.formatHelp(this, helper);
      }
      /**
       * @private
       */
      _getHelpContext(contextOptions) {
        contextOptions = contextOptions || {};
        const context = { error: !!contextOptions.error };
        let write;
        if (context.error) {
          write = (arg) => this._outputConfiguration.writeErr(arg);
        } else {
          write = (arg) => this._outputConfiguration.writeOut(arg);
        }
        context.write = contextOptions.write || write;
        context.command = this;
        return context;
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const context = this._getHelpContext(contextOptions);
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", context));
        this.emit("beforeHelp", context);
        let helpInformation = this.helpInformation(context);
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        context.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", context);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", context)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            this._helpOption = this._helpOption ?? void 0;
          } else {
            this._helpOption = null;
          }
          return this;
        }
        flags = flags ?? "-h, --help";
        description = description ?? "display help for command";
        this._helpOption = this.createOption(flags, description);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = process2.exitCode || 0;
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    exports.Command = Command2;
  }
});

// node_modules/commander/index.js
var require_commander = __commonJS({
  "node_modules/commander/index.js"(exports) {
    var { Argument: Argument2 } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError: CommanderError2, InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2 } = require_option();
    exports.program = new Command2();
    exports.createCommand = (name) => new Command2(name);
    exports.createOption = (flags, description) => new Option2(flags, description);
    exports.createArgument = (name, description) => new Argument2(name, description);
    exports.Command = Command2;
    exports.Option = Option2;
    exports.Argument = Argument2;
    exports.Help = Help2;
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
    exports.InvalidOptionArgumentError = InvalidArgumentError2;
  }
});

// src/ceremonies/designReview.ts
import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
function reviewersFor(hasAudio) {
  const out = [...CORE_REVIEWERS];
  if (hasAudio) {
    const idx = out.indexOf("a11y-auditor");
    if (idx === -1) {
      out.push(AUDIO_REVIEWER);
    } else {
      out.splice(idx, 0, AUDIO_REVIEWER);
    }
  }
  return out;
}
function nowIso() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function rstrip(s) {
  return s.replace(/\s+$/, "");
}
function pythonStyleJsonStringify(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`
    );
    return `{${pairs.join(", ")}}`;
  }
  throw new TypeError(`designReview: unsupported value type ${typeof value}.`);
}
function appendEvent(harnessDir, event) {
  const logPath = join(harnessDir, "events.log");
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${pythonStyleJsonStringify(event)}
`, "utf-8");
}
function template(featureId2, reviewers, timestamp) {
  const lines = [];
  lines.push(`# Design Review \u2014 ${featureId2}`);
  lines.push("");
  lines.push(`> \uC790\uB3D9 \uC0DD\uC131 \u2014 ${timestamp}`);
  lines.push(">");
  lines.push(
    "> `scripts/design_review.py` \uAC00 \uC774 \uD15C\uD50C\uB9BF\uC744 \uB9CC\uB4E4\uACE0, orchestrator \uAC00 reviewer \uBCC4\uB85C `flows.md` \uC5D0 \uB300\uD55C concern \uC744 \uD55C \uBB38\uB2E8\uC529 \uC218\uC9D1 \u2192 \uB9C8\uC9C0\uB9C9 Decisions \uC139\uC158\uC740 orchestrator \uAC00 disposition \uD6C4 \uC791\uC131."
  );
  lines.push("");
  lines.push(`## Reviewers (${reviewers.length})`);
  lines.push("");
  for (const r of reviewers) {
    lines.push(`- \`@harness:${r}\``);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const r of reviewers) {
    lines.push(`## ${r} concerns`);
    lines.push("");
    lines.push("<!-- orchestrator: \uC774 reviewer \uC758 Tier anchor \uAE30\uBC18 \uD55C \uBB38\uB2E8 concern -->");
    lines.push("");
    lines.push("_(pending)_");
    lines.push("");
  }
  lines.push("## Decisions");
  lines.push("");
  lines.push(
    "<!-- orchestrator: reviewer concern \uC744 \uC885\uD569\uD574 \uC218\uC6A9/\uC5F0\uAE30/\uAE30\uAC01 \uD310\uB2E8. 2\uD68C \uBC18\uBCF5 \uCDA9\uB3CC \uC2DC \uC0AC\uC6A9\uC790 escalate. -->"
  );
  lines.push("");
  lines.push("_(pending)_");
  lines.push("");
  return `${rstrip(lines.join("\n"))}
`;
}
function generateDesignReview(harnessDir, featureId2, options = {}) {
  const hasAudio = options.hasAudio ?? false;
  const timestamp = options.timestamp ?? nowIso();
  const reviewers = reviewersFor(hasAudio);
  const reviewDir = join(harnessDir, "_workspace", "design-review");
  mkdirSync(reviewDir, { recursive: true });
  const path = join(reviewDir, `${featureId2}.md`);
  writeFileSync(path, template(featureId2, reviewers, timestamp), "utf-8");
  appendEvent(harnessDir, {
    ts: timestamp,
    type: "design_review_opened",
    feature: featureId2,
    reviewers,
    has_audio: hasAudio,
    path: relative(harnessDir, path)
  });
  return path;
}
var CORE_REVIEWERS, AUDIO_REVIEWER;
var init_designReview = __esm({
  "src/ceremonies/designReview.ts"() {
    "use strict";
    CORE_REVIEWERS = [
      "visual-designer",
      "frontend-engineer",
      "a11y-auditor"
    ];
    AUDIO_REVIEWER = "audio-designer";
  }
});

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t2) => t2.tag === tagName);
        const tagObj = match.find((t2) => !t2.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t2) => t2.identify?.(value) && !t2.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t2 = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t2);
        if (res === null)
          throw new Error(`Unsupported default string type ${t2}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t2) => t2.tag === item.tag);
        if (match.length > 0)
          return match.find((t2) => t2.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t2) => t2.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t2) => t2.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t2) => t2.format === item.format) ?? match.find((t2) => !t2.format);
      } else {
        obj = item;
        tagObj = tags.find((t2) => t2.nodeClass && obj instanceof t2.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (identity.isSeq(value))
        for (const it of value.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(value))
        for (const it of value)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, value);
    }
    function mergeValue(ctx, map, value) {
      const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t2) => t2.tag === tagName && t2.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = { x: 2, u: 4, U: 8 }[next];
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      if (isNaN(code)) {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
      return String.fromCodePoint(code);
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          Array.prototype.push.apply(doc.errors, this.errors);
          Array.prototype.push.apply(doc.warnings, this.warnings);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return yield* this.parseBlockStart();
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        switch (this.charAt(0)) {
          case "!":
            return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "&":
            return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
            }
          }
        }
        return 0;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                Array.prototype.push.apply(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              Array.prototype.push.apply(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/core/routing.ts
var ROUTING_SHAPES, PARALLEL_GROUPS;
var init_routing = __esm({
  "src/core/routing.ts"() {
    "use strict";
    ROUTING_SHAPES = {
      "baseline-empty-vague": ["researcher", "product-planner"],
      "ui_surface.present": [
        "ux-architect",
        "visual-designer",
        "a11y-auditor",
        "frontend-engineer",
        "software-engineer"
      ],
      sensitive_or_auth: ["security-engineer", "reviewer"],
      performance_budget: ["performance-engineer"],
      pure_domain_logic: ["backend-engineer", "software-engineer"],
      feature_completion: ["qa-engineer", "integrator", "tech-writer", "reviewer"]
    };
    PARALLEL_GROUPS = {
      sensitive_or_auth: [["security-engineer", "reviewer"]],
      "ui_surface.present": [["visual-designer", "audio-designer"]]
    };
  }
});

// src/ceremonies/kickoff.ts
import { appendFileSync as appendFileSync2, mkdirSync as mkdirSync2, readFileSync, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join2, relative as relative2 } from "node:path";
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function hasAudioFlag(feature) {
  if (!isPlainObject(feature)) {
    return false;
  }
  const ui = feature["ui_surface"];
  if (!isPlainObject(ui)) {
    return false;
  }
  return Boolean(ui["has_audio"]);
}
function touchesSensitiveEntity(feature, spec) {
  if (!isPlainObject(spec) || !isPlainObject(feature)) {
    return false;
  }
  const domain = isPlainObject(spec["domain"]) ? spec["domain"] : {};
  const entities = asArray(domain["entities"]);
  const sensitiveNames = [];
  for (const e of entities) {
    if (isPlainObject(e) && e["sensitive"] === true) {
      const name = e["name"];
      if (typeof name === "string" && name.length > 0) {
        sensitiveNames.push(name.toLowerCase());
      }
    }
  }
  if (sensitiveNames.length === 0) {
    return false;
  }
  const parts = [];
  if (typeof feature["title"] === "string") {
    parts.push(feature["title"]);
  }
  for (const m of asArray(feature["modules"])) {
    if (typeof m === "string") {
      parts.push(m);
    }
  }
  for (const ac of asArray(feature["acceptance_criteria"])) {
    if (typeof ac === "string") {
      parts.push(ac);
    }
  }
  const haystack = parts.join(" ").toLowerCase();
  return sensitiveNames.some((name) => haystack.includes(name));
}
function detectShapes(feature, spec = null) {
  if (!isPlainObject(feature)) {
    return [];
  }
  const title = typeof feature["title"] === "string" ? feature["title"].trim() : "";
  const ac = asArray(feature["acceptance_criteria"]);
  const modules = asArray(feature["modules"]);
  if (title.length === 0 && ac.length === 0 && modules.length === 0) {
    return ["baseline-empty-vague"];
  }
  const shapes = [];
  const ui = isPlainObject(feature["ui_surface"]) ? feature["ui_surface"] : {};
  if (ui["present"] === true) {
    shapes.push("ui_surface.present");
  }
  if (feature["performance_budget"] !== void 0 && feature["performance_budget"] !== null) {
    shapes.push("performance_budget");
  }
  if (feature["sensitive"] === true) {
    shapes.push("sensitive_or_auth");
  } else if (touchesSensitiveEntity(feature, spec)) {
    shapes.push("sensitive_or_auth");
  }
  if (shapes.length === 0) {
    shapes.push("pure_domain_logic");
  }
  shapes.push("feature_completion");
  return shapes;
}
function agentsForShapes(shapes, hasAudio = false) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const shape of shapes) {
    const agents = ROUTING_SHAPES[shape] ?? [];
    for (const agent of agents) {
      if (!seen.has(agent)) {
        seen.add(agent);
        out.push(agent);
      }
    }
    if (shape === "ui_surface.present" && hasAudio && !seen.has("audio-designer")) {
      seen.add("audio-designer");
      const idx = out.indexOf("a11y-auditor");
      if (idx === -1) {
        out.push("audio-designer");
      } else {
        out.splice(idx, 0, "audio-designer");
      }
    }
  }
  return out;
}
function parallelGroupsForShapes(shapes, hasAudio = false) {
  const groups = [];
  const seen = /* @__PURE__ */ new Set();
  for (const shape of shapes) {
    const candidates = PARALLEL_GROUPS[shape] ?? [];
    for (const group of candidates) {
      const members = group.filter((m) => hasAudio || m !== "audio-designer");
      if (members.length < 2) {
        continue;
      }
      const key = members.join("|");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      groups.push([...members]);
    }
  }
  return groups;
}
function nowIso2() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function rstrip2(s) {
  return s.replace(/\s+$/, "");
}
function isFile(path) {
  try {
    return statSync2(path).isFile();
  } catch {
    return false;
  }
}
function pythonStyleJsonStringify2(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify2(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify2(v)}`
    );
    return `{${pairs.join(", ")}}`;
  }
  throw new TypeError(`kickoff: unsupported value type ${typeof value}.`);
}
function appendEvent2(harnessDir, event) {
  const logPath = join2(harnessDir, "events.log");
  mkdirSync2(dirname2(logPath), { recursive: true });
  appendFileSync2(logPath, `${pythonStyleJsonStringify2(event)}
`, "utf-8");
}
function renderStyleBlock(harnessDir, feature) {
  const indexPath = join2(harnessDir, "area_index.yaml");
  if (!isFile(indexPath)) {
    return "";
  }
  let loaded;
  try {
    loaded = (0, import_yaml.parse)(readFileSync(indexPath, "utf-8"));
  } catch {
    return "";
  }
  const areas = isPlainObject(loaded) ? asArray(loaded["areas"]) : [];
  if (!isPlainObject(feature)) {
    return "";
  }
  const featureModules = /* @__PURE__ */ new Set();
  for (const m of asArray(feature["modules"])) {
    if (typeof m === "string") {
      featureModules.add(m);
    }
  }
  if (featureModules.size === 0) {
    return "";
  }
  const matched = [];
  for (const entry of areas) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const entryModules = /* @__PURE__ */ new Set();
    for (const m of asArray(entry["modules"])) {
      if (typeof m === "string") {
        entryModules.add(m);
      }
    }
    for (const m of entryModules) {
      if (featureModules.has(m)) {
        matched.push(entry);
        break;
      }
    }
  }
  if (matched.length === 0) {
    return "";
  }
  const lines = [];
  lines.push("## \uAE30\uC874 \uC2A4\uD0C0\uC77C \uCEE8\uD14D\uC2A4\uD2B8 (auto \xB7 F-037)");
  lines.push("");
  lines.push(
    "> \uC5B4\uB460\uC774 \uAC77\uD78C \uC601\uC5ED. \uC544\uB798 chapter \uAC00 implementer / software-engineer / frontend-engineer \uC758 \uAE30\uBCF8 \uCEE8\uD14D\uC2A4\uD2B8."
  );
  lines.push("");
  lines.push("### \uAD00\uB828 area chapter");
  for (const entry of matched) {
    const label = entry["label"] ?? entry["slug"] ?? "area";
    const chapterPath = entry["chapter_path"] ?? "";
    lines.push(`- [${label}](../../${chapterPath})`);
  }
  lines.push("");
  return `${lines.join("\n")}
`;
}
function template2(featureId2, agents, timestamp, mode, styleBlock) {
  const isPrototype = mode === "prototype";
  const bulletsPerAgent = isPrototype ? 1 : 3;
  const guidance = isPrototype ? "\uC774 agent \uC758 \uAD00\uC810\uC5D0\uC11C \uAC00\uC7A5 \uD070 \uC6B0\uB824 1 \uC904." : "\uC774 agent \uC758 Tier anchor \uAE30\uBC18 3-bullet \uC6B0\uB824 \xB7 80 \uB2E8\uC5B4 \uC774\uB0B4";
  const intro = isPrototype ? "\uD504\uB85C\uD1A0\uD0C0\uC785 \uBAA8\uB4DC \u2014 \uAC01 agent \uAC00 1 \uC904\uC529\uB9CC \uC6B0\uB824\uB97C \uC801\uB294\uB2E4." : "orchestrator \uAC00 \uAC01 agent \uB97C \uC18C\uD658\uD574 \uC139\uC158\uC744 \uCC44\uC6B4\uB2E4 (80 \uB2E8\uC5B4 \uB0B4 3 bullet). cross-role empathy \uC6A9.";
  const lines = [];
  lines.push(`# Kickoff \u2014 ${featureId2}`);
  lines.push("");
  lines.push(`> \uC790\uB3D9 \uC0DD\uC131 \u2014 ${timestamp} \xB7 mode: \`${mode}\``);
  lines.push(">");
  lines.push(`> \`scripts/kickoff.py\` \uAC00 \uC774 \uD15C\uD50C\uB9BF\uC744 \uB9CC\uB4E4\uACE0, ${intro}`);
  lines.push("");
  lines.push(`## \uCC38\uC5EC \uC5D0\uC774\uC804\uD2B8 (${agents.length})`);
  lines.push("");
  for (const a of agents) {
    lines.push(`- \`@harness:${a}\``);
  }
  lines.push("");
  if (styleBlock) {
    lines.push(rstrip2(styleBlock));
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  for (const agent of agents) {
    lines.push(`## ${agent} \uC758 \uAD00\uC810`);
    lines.push("");
    lines.push(`<!-- orchestrator: ${guidance} -->`);
    lines.push("");
    for (let i = 0; i < bulletsPerAgent; i++) {
      lines.push("- ");
    }
    lines.push("");
  }
  return `${rstrip2(lines.join("\n"))}
`;
}
function generateKickoff(harnessDir, featureId2, shapes, options = {}) {
  const hasAudio = options.hasAudio ?? false;
  const timestamp = options.timestamp ?? nowIso2();
  const force = options.force ?? false;
  const mode = options.mode ?? "product";
  const styleBlock = options.styleBlock ?? "";
  const agents = agentsForShapes(shapes, hasAudio);
  if (agents.length === 0) {
    throw new Error(
      `no agents matched for shapes=${JSON.stringify([...shapes])}; check ROUTING_SHAPES`
    );
  }
  const kickoffDir = join2(harnessDir, "_workspace", "kickoff");
  mkdirSync2(kickoffDir, { recursive: true });
  const kickoffPath = join2(kickoffDir, `${featureId2}.md`);
  if (isFile(kickoffPath) && !force) {
    return kickoffPath;
  }
  writeFileSync2(kickoffPath, template2(featureId2, agents, timestamp, mode, styleBlock), "utf-8");
  appendEvent2(harnessDir, {
    ts: timestamp,
    type: "kickoff_started",
    feature: featureId2,
    shapes: [...shapes],
    agents,
    mode,
    path: relative2(harnessDir, kickoffPath)
  });
  return kickoffPath;
}
var import_yaml;
var init_kickoff = __esm({
  "src/ceremonies/kickoff.ts"() {
    "use strict";
    import_yaml = __toESM(require_dist(), 1);
    init_routing();
  }
});

// src/ceremonies/retro.ts
import { appendFileSync as appendFileSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync2, statSync as statSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join3, relative as relative3 } from "node:path";
function isPlainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readEvents(harnessDir) {
  const logPath = join3(harnessDir, "events.log");
  let raw;
  try {
    raw = readFileSync2(logPath, "utf-8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (isPlainObject2(parsed)) {
        out.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return out;
}
function analyze(events, featureId2) {
  const relevant = events.filter((e) => e["feature"] === featureId2);
  const gateEvents = relevant.filter((e) => e["type"] === "gate_recorded");
  let firstGateFail = null;
  for (const e of gateEvents) {
    if (e["result"] === "fail") {
      firstGateFail = e;
      break;
    }
  }
  const completed = relevant.some((e) => e["type"] === "feature_done");
  const kickoffOpened = relevant.some((e) => e["type"] === "kickoff_started");
  const designReviewOpened = relevant.some((e) => e["type"] === "design_review_opened");
  const questionsOpened = relevant.filter((e) => e["type"] === "question_opened").length;
  const questionsAnswered = relevant.filter((e) => e["type"] === "question_answered").length;
  let archivedEvent = null;
  for (const e of relevant) {
    if (e["type"] === "feature_archived") {
      archivedEvent = e;
    }
  }
  return {
    completed,
    first_gate_fail: firstGateFail,
    kickoff_opened: kickoffOpened,
    design_review_opened: designReviewOpened,
    questions_opened: questionsOpened,
    questions_answered: questionsAnswered,
    gate_events_total: gateEvents.length,
    all_events_total: relevant.length,
    archived: archivedEvent !== null,
    archived_event: archivedEvent
  };
}
function rstrip3(s) {
  return s.replace(/\s+$/, "");
}
function nowIso3() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function isFile2(path) {
  try {
    return statSync3(path).isFile();
  } catch {
    return false;
  }
}
function pythonStyleJsonStringify3(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify3(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify3(v)}`
    );
    return `{${pairs.join(", ")}}`;
  }
  throw new TypeError(`retro: unsupported value type ${typeof value}.`);
}
function appendEvent3(harnessDir, event) {
  const logPath = join3(harnessDir, "events.log");
  mkdirSync3(dirname3(logPath), { recursive: true });
  appendFileSync3(logPath, `${pythonStyleJsonStringify3(event)}
`, "utf-8");
}
function template3(featureId2, analysis, timestamp, mode) {
  const isPrototype = mode === "prototype";
  const fgf = analysis.first_gate_fail;
  const fgfLine = fgf !== null ? `- ${fgf["gate"] ?? "?"} failed at ${fgf["ts"] ?? "?"}  (reason: ${fgf["note"] || fgf["reason"] || "?"})` : "- \uC5C6\uC74C (\uC804 gate \uCD5C\uCD08\uC5D0 pass)";
  const intro = isPrototype ? "\uD504\uB85C\uD1A0\uD0C0\uC785 \uBAA8\uB4DC \u2014 \uBA38\uC2E0 \uC139\uC158\uB9CC \uC790\uB3D9 \uCC44\uC6C0. LLM \uBC18\uC131 \uC139\uC158\uC740 \uC0DD\uB7B5." : "`scripts/retro.py` \uAC00 events.log \uB97C \uBD84\uC11D\uD574 \uBA38\uC2E0 \uC139\uC158\uC744 \uCC44\uC6B0\uACE0, orchestrator \uAC00 reviewer \u2192 tech-writer \uC21C\uCC28\uB85C Reviewer Reflection \xB7 Copy Polish \uC139\uC158\uC744 \uC644\uC131\uD55C\uB2E4.";
  const lines = [];
  lines.push(`# Retrospective \u2014 ${featureId2}`);
  lines.push("");
  lines.push(`> \uC790\uB3D9 \uC0DD\uC131 \u2014 ${timestamp} \xB7 mode: \`${mode}\``);
  lines.push(">");
  lines.push(`> ${intro}`);
  lines.push("");
  lines.push("## What Shipped");
  lines.push("");
  if (analysis.completed) {
    lines.push(`- ${featureId2} \u2014 complete \uC804\uC774 \uAC10\uC9C0.`);
  } else {
    lines.push(`- ${featureId2} \u2014 complete \uC774\uBCA4\uD2B8 \uBBF8\uAC10\uC9C0. \uC218\uB3D9 \uD655\uC778 \uD544\uC694.`);
  }
  lines.push("");
  if (analysis.archived) {
    const ev = analysis.archived_event ?? {};
    const sb = ev["superseded_by"];
    const reason = ev["reason"] ?? "(reason \uBBF8\uAE30\uB85D)";
    const ts = ev["ts"] ?? "?";
    lines.push("## Superseded By");
    lines.push("");
    if (typeof sb === "string" && sb.length > 0) {
      lines.push(`- \uC774 \uD53C\uCC98\uB294 **${sb}** \uB85C \uB300\uCCB4\uB428 (${ts})`);
    } else {
      lines.push(
        `- \uC774 \uD53C\uCC98\uB294 archived \uB428 (${ts}) \u2014 superseded_by \uBBF8\uC9C0\uC815 (deprecation only \xB7 \uB300\uCCB4 \uD53C\uCC98 \uC5C6\uC74C)`
      );
    }
    lines.push(`- \uC0AC\uC720: ${reason}`);
    lines.push("");
    lines.push(
      "<!-- F-028: feature_archived event \uC758 superseded_by/reason \uC790\uB3D9 \uCC44\uC6C0. \uC218\uB3D9 \uCD94\uAC00 \uCEE8\uD14D\uC2A4\uD2B8\uB294 \uC544\uB798\uC5D0 \uC790\uC720 \uAE30\uC220. -->"
    );
    lines.push("");
  }
  lines.push("## First Gate to Fail");
  lines.push("");
  lines.push(fgfLine);
  lines.push("");
  lines.push("## Ceremonies");
  lines.push("");
  lines.push(`- Kickoff opened: ${analysis.kickoff_opened ? "\u2705" : "\u274C"}`);
  lines.push(
    `- Design Review opened: ${analysis.design_review_opened ? "\u2705" : "\u274C (\uD574\uB2F9 \uD53C\uCC98\uC5D0 \uBBF8\uC2E4\uD589)"}`
  );
  lines.push(
    `- Questions opened: ${analysis.questions_opened} \xB7 answered: ${analysis.questions_answered}`
  );
  lines.push("");
  if (isPrototype) {
    return `${rstrip3(lines.join("\n"))}
`;
  }
  for (const heading of [
    "Risks Materialized vs plan.md",
    "Decisions Revised",
    "Kickoff Predictions That Were Right / Wrong"
  ]) {
    lines.push(`## ${heading}`);
    lines.push("");
    lines.push(`<!-- orchestrator via reviewer: ${heading} \uC139\uC158 -->`);
    lines.push("");
    lines.push("_(pending)_");
    lines.push("");
  }
  lines.push("## Reviewer Reflection");
  lines.push("");
  lines.push(
    "<!-- orchestrator invokes @harness:reviewer to produce draft prose. reviewer \uB294 read-only (CQS) \u2014 draft \uD14D\uC2A4\uD2B8\uB9CC \uBC18\uD658. orchestrator \uAC00 \uC774 \uC139\uC158\uC5D0 write. -->"
  );
  lines.push("");
  lines.push("_(pending)_");
  lines.push("");
  lines.push("## Copy Polish");
  lines.push("");
  lines.push(
    "<!-- orchestrator invokes @harness:tech-writer to polish the Reviewer Reflection. tech-writer \uAC00 Write/Edit \uC73C\uB85C \uC9C1\uC811 \uC774 \uC139\uC158\uC744 \uB2E4\uB4EC\uC74C. -->"
  );
  lines.push("");
  lines.push("_(pending)_");
  lines.push("");
  return `${rstrip3(lines.join("\n"))}
`;
}
function generateRetro(harnessDir, featureId2, options = {}) {
  const timestamp = options.timestamp ?? nowIso3();
  const force = options.force ?? false;
  const mode = options.mode ?? "product";
  const retroDir = join3(harnessDir, "_workspace", "retro");
  mkdirSync3(retroDir, { recursive: true });
  const path = join3(retroDir, `${featureId2}.md`);
  if (isFile2(path) && !force) {
    return path;
  }
  const events = readEvents(harnessDir);
  const analysis = analyze(events, featureId2);
  writeFileSync3(path, template3(featureId2, analysis, timestamp, mode), "utf-8");
  appendEvent3(harnessDir, {
    ts: timestamp,
    type: "feature_retro_written",
    feature: featureId2,
    mode,
    analysis_summary: {
      completed: analysis.completed,
      first_gate_fail: analysis.first_gate_fail !== null ? analysis.first_gate_fail["gate"] : null,
      questions_opened: analysis.questions_opened
    },
    path: relative3(harnessDir, path)
  });
  return path;
}
var init_retro = __esm({
  "src/ceremonies/retro.ts"() {
    "use strict";
  }
});

// src/core/projectMode.ts
function resolveMode(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    return DEFAULT_MODE;
  }
  const project = spec["project"];
  if (project === null || typeof project !== "object" || Array.isArray(project)) {
    return DEFAULT_MODE;
  }
  const mode = project["mode"];
  if (typeof mode === "string" && VALID_MODES.has(mode)) {
    return mode;
  }
  return DEFAULT_MODE;
}
var VALID_MODES, DEFAULT_MODE;
var init_projectMode = __esm({
  "src/core/projectMode.ts"() {
    "use strict";
    VALID_MODES = /* @__PURE__ */ new Set(["prototype", "product"]);
    DEFAULT_MODE = "product";
  }
});

// src/core/canonicalHash.ts
import { createHash } from "node:crypto";
function canonicalize(value) {
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `canonical_hash: non-finite number encountered (${String(value)}); Python equivalent uses allow_nan=False which raises ValueError.`
      );
    }
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(
        `canonical_hash: only plain objects are canonicalizable; received instance of ${value.constructor?.name ?? "unknown"}.`
      );
    }
    const obj = value;
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(obj[key]);
    }
    return result;
  }
  throw new TypeError(
    `canonical_hash: cannot serialize value of type ${typeof value}.`
  );
}
function canonicalBytes(value) {
  const sorted = canonicalize(value);
  const json = JSON.stringify(sorted);
  return Buffer.from(json, "utf-8");
}
function canonicalHash(value) {
  return createHash("sha256").update(canonicalBytes(value)).digest("hex");
}
function subtreeHashes(spec) {
  const result = {};
  for (const key of SUBTREE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(spec, key)) {
      result[key] = canonicalHash(spec[key]);
    }
  }
  return result;
}
function merkleRoot(subtrees) {
  const entries = Object.entries(subtrees);
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const combined = entries.map(([key, hash]) => ({ key, hash }));
  return canonicalHash(combined);
}
var SUBTREE_KEYS;
var init_canonicalHash = __esm({
  "src/core/canonicalHash.ts"() {
    "use strict";
    SUBTREE_KEYS = [
      "project",
      "domain",
      "constraints",
      "deliverable",
      "features",
      "metadata"
    ];
  }
});

// src/core/state.ts
import { existsSync, mkdirSync as mkdirSync4, readFileSync as readFileSync4, statSync as statSync5, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname4, join as join5 } from "node:path";
function nowIso4() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function defaultState() {
  return {
    version: "2.3",
    schema_version: "2.3",
    features: [],
    session: {
      started_at: null,
      last_command: "",
      last_gate_passed: null,
      active_feature_id: null
    }
  };
}
function isPlainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isDeclaredEvidence(ev) {
  if (!isPlainObject4(ev)) {
    return false;
  }
  const kind = ev.kind;
  if (typeof kind !== "string") {
    return true;
  }
  return !AUTOMATIC_EVIDENCE_KINDS.has(kind);
}
function parseTs(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}
function countDeclaredEvidence(feature, options = {}) {
  if (!isPlainObject4(feature)) {
    return 0;
  }
  const windowDays = options.windowDays ?? IRON_LAW_WINDOW_DAYS;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const cutoffMs = now.getTime() - Math.max(windowDays, 0) * 24 * 60 * 60 * 1e3;
  const evidence = feature.evidence;
  if (!Array.isArray(evidence)) {
    return 0;
  }
  let count = 0;
  for (const ev of evidence) {
    if (!isDeclaredEvidence(ev)) {
      continue;
    }
    const ts = parseTs(ev.ts);
    if (ts !== null && ts.getTime() < cutoffMs) {
      continue;
    }
    count += 1;
  }
  return count;
}
var import_yaml3, GOAL_STATUSES, FEATURE_STATUSES, GATE_RESULTS, AUTOMATIC_EVIDENCE_KINDS, IRON_LAW_WINDOW_DAYS, State;
var init_state = __esm({
  "src/core/state.ts"() {
    "use strict";
    import_yaml3 = __toESM(require_dist(), 1);
    GOAL_STATUSES = [
      "planning",
      "scaffolded",
      "executing",
      "done",
      "paused",
      "blocked"
    ];
    FEATURE_STATUSES = [
      "planned",
      "in_progress",
      "blocked",
      "done",
      "archived"
    ];
    GATE_RESULTS = ["pass", "fail", "skipped"];
    AUTOMATIC_EVIDENCE_KINDS = /* @__PURE__ */ new Set(["gate_run", "gate_auto_run"]);
    IRON_LAW_WINDOW_DAYS = 7;
    State = class _State {
      /** Resolved absolute path of `state.yaml` for this view. */
      path;
      /** In-memory state document. Mutations are visible here immediately. */
      data;
      /** Construct directly when the path and data are already resolved. */
      constructor(path, data) {
        this.path = path;
        this.data = data;
      }
      /**
       * Reads `<harnessDir>/state.yaml` and returns a {@link State} view.
       *
       * When the file does not exist the view is initialized with the
       * default schema; nothing is written to disk until
       * {@link State.save} is called.
       *
       * @param harnessDir - Path to the project's `.harness/` directory.
       * @returns A new `State` instance.
       */
      static load(harnessDir) {
        const path = join5(harnessDir, "state.yaml");
        let data;
        if (existsSync(path) && statSync5(path).isFile()) {
          const raw = readFileSync4(path, "utf-8");
          const parsed = (0, import_yaml3.parse)(raw);
          if (isPlainObject4(parsed)) {
            data = parsed;
          } else {
            data = defaultState();
          }
        } else {
          data = defaultState();
        }
        if (!isPlainObject4(data.session)) {
          data.session = defaultState().session;
        }
        if (!Array.isArray(data.features)) {
          data.features = [];
        }
        return new _State(path, data);
      }
      /** Persist the in-memory shape back to disk. */
      save() {
        mkdirSync4(dirname4(this.path), { recursive: true });
        const out = (0, import_yaml3.stringify)(this.data, {
          // Preserve insertion order — Python's PyYAML used `sort_keys=False`.
          sortMapEntries: false,
          // Avoid extra indent on sequences inside maps so the output stays
          // close to PyYAML's `default_flow_style=False` block style.
          indentSeq: false,
          // No hard wrap — long strings stay on one line.
          lineWidth: 0
        });
        writeFileSync4(this.path, out, "utf-8");
      }
      // --------------------------------------------------------------------
      // Feature helpers
      // --------------------------------------------------------------------
      /** All feature ids currently in the `features[]` array. */
      featureIds() {
        const ids = [];
        for (const f of this.data.features) {
          if (isPlainObject4(f) && typeof f.id === "string") {
            ids.push(f.id);
          }
        }
        return ids;
      }
      /** Returns the feature record matching `fid`, or `null`. */
      getFeature(fid) {
        for (const f of this.data.features) {
          if (isPlainObject4(f) && f.id === fid) {
            return f;
          }
        }
        return null;
      }
      /**
       * Returns the feature record for `fid`, inserting a `planned`
       * placeholder when the id is new.
       *
       * Identity is preserved across calls — mutations on the returned
       * object are visible on the next {@link State.save}.
       */
      ensureFeature(fid) {
        const existing = this.getFeature(fid);
        if (existing !== null) {
          return existing;
        }
        const entry = {
          id: fid,
          status: "planned",
          gates: {},
          evidence: [],
          started_at: null,
          completed_at: null
        };
        this.data.features.push(entry);
        return entry;
      }
      /**
       * Sets `feature.status` for `fid`, updating `started_at` /
       * `completed_at` lifecycle timestamps when the transition warrants.
       *
       * Resetting to `planned` is allowed but does not clear timestamps —
       * the user can audit prior progress. Throws on unknown status.
       */
      setStatus(fid, status) {
        if (!FEATURE_STATUSES.includes(status)) {
          throw new Error(
            `invalid status '${status}' (expected one of ${FEATURE_STATUSES.join(", ")})`
          );
        }
        const f = this.ensureFeature(fid);
        f.status = status;
        const ts = nowIso4();
        if (status === "in_progress" && f.started_at === null) {
          f.started_at = ts;
        }
        if (status === "done" && f.completed_at === null) {
          f.completed_at = ts;
        }
      }
      /**
       * Writes `feature.gates[gateName]` for `fid` and updates
       * `session.last_gate_passed` on `pass`.
       *
       * Throws on unknown gate result.
       */
      recordGateResult(fid, gateName, result, options = {}) {
        if (!GATE_RESULTS.includes(result)) {
          throw new Error(`invalid gate result '${result}'`);
        }
        const f = this.ensureFeature(fid);
        if (!isPlainObject4(f.gates)) {
          f.gates = {};
        }
        f.gates[gateName] = {
          last_result: result,
          ts: options.ts ?? nowIso4(),
          note: options.note ?? ""
        };
        if (result === "pass") {
          this.data.session.last_gate_passed = gateName;
        }
      }
      /**
       * Appends an evidence row to `features[fid].evidence`.
       *
       * Evidence is the unit Iron Law counts; see
       * {@link countDeclaredEvidence} for what qualifies as declared.
       */
      addEvidence(fid, kind, summary, options = {}) {
        const f = this.ensureFeature(fid);
        if (!Array.isArray(f.evidence)) {
          f.evidence = [];
        }
        f.evidence.push({
          ts: options.ts ?? nowIso4(),
          kind,
          summary
        });
      }
      /**
       * Records that an agent was intentionally skipped for a feature.
       *
       * v0.5 routing documented `skipped_agents[]` but the original
       * Python state module never implemented the writer — orchestrator
       * skip decisions left no audit trail. v0.7.2 added the API; this
       * port preserves it.
       *
       * @throws when `agent` is empty or `reason` is empty (silent skips
       *   defeat the audit purpose).
       */
      addSkippedAgent(fid, agent, reason, options = {}) {
        if (!agent) {
          throw new Error("agent name required");
        }
        if (!reason) {
          throw new Error("reason required \u2014 silent skips defeat the audit purpose");
        }
        const f = this.ensureFeature(fid);
        let skipped = f.skipped_agents;
        if (!Array.isArray(skipped)) {
          skipped = [];
          f.skipped_agents = skipped;
        }
        skipped.push({
          agent,
          reason,
          ts: options.ts ?? nowIso4()
        });
      }
      /** Returns a shallow copy of the skipped-agents log for `fid`. */
      getSkippedAgents(fid) {
        const f = this.getFeature(fid);
        if (f === null) {
          return [];
        }
        if (!Array.isArray(f.skipped_agents)) {
          return [];
        }
        return [...f.skipped_agents];
      }
      // --------------------------------------------------------------------
      // Session helpers
      // --------------------------------------------------------------------
      /**
       * Sets `session.active_feature_id`.
       *
       * Auto-registers the feature as `planned` when the id is unknown
       * (mirrors Python so a typo'd activate does not corrupt the file).
       */
      setActive(fid) {
        if (fid !== null && this.getFeature(fid) === null) {
          this.ensureFeature(fid);
        }
        this.data.session.active_feature_id = fid;
      }
      /**
       * Removes a feature from `features[]`.
       *
       * Returns `true` when something was removed. Also clears
       * `session.active_feature_id` when it pointed at the removed id.
       */
      removeFeature(fid) {
        const before = this.data.features.length;
        this.data.features = this.data.features.filter(
          (f) => !(isPlainObject4(f) && f.id === fid)
        );
        const removed = this.data.features.length < before;
        if (removed && this.data.session.active_feature_id === fid) {
          this.data.session.active_feature_id = null;
        }
        return removed;
      }
      /** Returns ids of all features whose status is `in_progress`. */
      featuresInProgress() {
        const out = [];
        for (const f of this.data.features) {
          if (isPlainObject4(f) && f.status === "in_progress" && typeof f.id === "string") {
            out.push(f.id);
          }
        }
        return out;
      }
      /**
       * Records the most recent slash-command invocation and stamps
       * `session.started_at` on the very first call.
       */
      setLastCommand(command) {
        this.data.session.last_command = command;
        if (this.data.session.started_at === null) {
          this.data.session.started_at = nowIso4();
        }
      }
      // --------------------------------------------------------------------
      // Goal helpers (v0.14.0 — F-118)
      // --------------------------------------------------------------------
      /**
       * Returns the in-memory goals array, normalizing missing or
       * malformed entries on a legacy state.yaml. Mutations on the
       * returned array are visible on the next {@link State.save}.
       */
      goals() {
        if (!Array.isArray(this.data.goals)) {
          this.data.goals = [];
        }
        return this.data.goals;
      }
      /** Returns the goal record for `gid`, or `null`. */
      getGoal(gid) {
        for (const g of this.goals()) {
          if (isPlainObject4(g) && g.id === gid) {
            return g;
          }
        }
        return null;
      }
      /**
       * Returns the goal record for `gid`, inserting a `planning`
       * placeholder when the id is new.
       *
       * Identity is preserved across calls — mutations on the returned
       * object are visible on the next {@link State.save}.
       */
      ensureGoal(gid) {
        const existing = this.getGoal(gid);
        if (existing !== null) {
          return existing;
        }
        const entry = {
          id: gid,
          status: "planning",
          started_at: null,
          completed_at: null,
          iteration: 0,
          elapsed_sec: 0,
          feature_progress: {},
          last_halt_reason: null
        };
        this.goals().push(entry);
        return entry;
      }
      /**
       * Sets `goal.status` for `gid`, updating `started_at` and
       * `completed_at` lifecycle timestamps when the transition warrants.
       *
       * Throws on unknown status. Resetting to an earlier phase is
       * allowed but does not clear timestamps.
       */
      setGoalStatus(gid, status) {
        if (!GOAL_STATUSES.includes(status)) {
          throw new Error(
            `invalid goal status '${status}' (expected one of ${GOAL_STATUSES.join(", ")})`
          );
        }
        const g = this.ensureGoal(gid);
        g.status = status;
        const ts = nowIso4();
        if (status === "executing" && g.started_at === null) {
          g.started_at = ts;
        }
        if (status === "done" && g.completed_at === null) {
          g.completed_at = ts;
        }
      }
      /**
       * Sets `session.active_goal_id`.
       *
       * BR-015 (g) — sequential constraint. The previous goal stays
       * recorded under `goals[]` but is no longer the driver target.
       */
      setActiveGoal(gid) {
        this.data.session.active_goal_id = gid;
      }
      /** Returns `session.active_goal_id` (defaults to `null`). */
      activeGoalId() {
        const v = this.data.session.active_goal_id;
        return typeof v === "string" ? v : null;
      }
      /**
       * Updates the cached per-feature status for a goal.
       *
       * Used by drive loop iterations to keep the progress renderer
       * snapshot current without re-walking `state.features[]` on every
       * render. Out-of-band updates (work.py setStatus on a feature
       * inside a goal) are reconciled on the next drive iteration.
       */
      setGoalFeatureProgress(gid, fid, status) {
        if (!FEATURE_STATUSES.includes(status)) {
          throw new Error(`invalid feature status '${status}'`);
        }
        const g = this.ensureGoal(gid);
        if (!isPlainObject4(g.feature_progress)) {
          g.feature_progress = {};
        }
        g.feature_progress[fid] = status;
      }
      /** Removes a goal from `goals[]`. Also clears active_goal_id when matching. */
      removeGoal(gid) {
        const before = this.goals().length;
        this.data.goals = this.goals().filter((g) => !(isPlainObject4(g) && g.id === gid));
        const removed = this.data.goals.length < before;
        if (removed && this.activeGoalId() === gid) {
          this.setActiveGoal(null);
        }
        return removed;
      }
      // --------------------------------------------------------------------
      // Summary helpers (used by status / check / dashboards)
      // --------------------------------------------------------------------
      /** Returns a `{status: count}` map for each FEATURE_STATUSES entry. */
      featureCounts() {
        const counts = {
          planned: 0,
          in_progress: 0,
          blocked: 0,
          done: 0,
          archived: 0
        };
        for (const f of this.data.features) {
          if (!isPlainObject4(f)) {
            continue;
          }
          const status = f.status ?? "planned";
          if (status in counts) {
            counts[status] += 1;
          }
        }
        return counts;
      }
      /**
       * Returns a deep-cloned snapshot of the in-memory state.
       *
       * Used by `/harness:status --json` and parity tests that want to
       * compare two states without aliasing concerns.
       */
      snapshot() {
        return structuredClone(this.data);
      }
    };
  }
});

// src/spec/includeExpander.ts
import { readFileSync as readFileSync5, statSync as statSync6 } from "node:fs";
import { isAbsolute, join as join6, relative as relative5, resolve as resolvePath } from "node:path";
function isIncludeNode(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value;
  const keys = Object.keys(obj);
  return keys.length === 1 && keys[0] === "$include" && typeof obj["$include"] === "string";
}
function findIncludes(obj) {
  const out = [];
  walk(obj, [], null, out);
  return out;
}
function walk(obj, path, parentKey, out) {
  if (isIncludeNode(obj)) {
    out.push({ path, target: obj.$include, parentKey });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((child, i) => walk(child, [...path, i], parentKey, out));
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      walk(v, [...path, k], k, out);
    }
  }
}
function readChapter(chaptersDir, rel) {
  if (isAbsolute(rel)) {
    throw new IncludeError(`$include \uAC12\uC740 \uC808\uB300 \uACBD\uB85C\uC77C \uC218 \uC5C6\uC74C: ${rel}`);
  }
  let chaptersAbs;
  try {
    chaptersAbs = resolvePath(chaptersDir);
  } catch {
    chaptersAbs = chaptersDir;
  }
  const target = resolvePath(chaptersAbs, rel);
  const relativeFromBase = relative5(chaptersAbs, target);
  if (relativeFromBase === "" || relativeFromBase.startsWith("..") || isAbsolute(relativeFromBase)) {
    throw new IncludeError(
      `$include \uACBD\uB85C\uAC00 chapters \uB514\uB809\uD130\uB9AC\uB97C \uBC97\uC5B4\uB0A8: ${rel} \u2192 ${target}`
    );
  }
  let isFile8;
  try {
    isFile8 = statSync6(target).isFile();
  } catch {
    throw new IncludeError(`$include \uB300\uC0C1 \uD30C\uC77C \uC5C6\uC74C: ${target}`);
  }
  if (!isFile8) {
    throw new IncludeError(`$include \uB300\uC0C1 \uD30C\uC77C \uC5C6\uC74C: ${target}`);
  }
  try {
    return readFileSync5(target, "utf-8");
  } catch (err) {
    throw new IncludeError(`$include \uD30C\uC77C \uC77D\uAE30 \uC2E4\uD328 (${target}): ${err.message}`);
  }
}
function applyReplacements(obj, replacements) {
  function inner(sub, currentPath) {
    const key = pathKey(currentPath);
    if (replacements.has(key)) {
      return replacements.get(key);
    }
    if (Array.isArray(sub)) {
      return sub.map((child, i) => inner(child, [...currentPath, i]));
    }
    if (sub !== null && typeof sub === "object") {
      const out = {};
      for (const [k, v] of Object.entries(sub)) {
        out[k] = inner(v, [...currentPath, k]);
      }
      return out;
    }
    return sub;
  }
  return inner(obj, []);
}
function pathKey(path) {
  return path.map((p) => typeof p === "number" ? `#${p}` : `.${p}`).join("");
}
function expand(spec, chaptersDir, options = {}) {
  const strictLockedFields = options.strictLockedFields ?? true;
  const includes = findIncludes(spec);
  if (includes.length === 0) {
    return spec;
  }
  const replacements = /* @__PURE__ */ new Map();
  for (const item of includes) {
    if (strictLockedFields && item.parentKey !== null && LOCKED_FIELD_NAMES.has(item.parentKey)) {
      throw new IncludeError(
        `\u{1F512} \uD544\uB4DC \`${item.parentKey}\` \uC5D0\uB294 $include \uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC74C (\uACBD\uB85C: ${item.path.join(".")}, target: ${item.target})`
      );
    }
    const content = readChapter(chaptersDir, item.target);
    replacements.set(pathKey(item.path), content);
  }
  return applyReplacements(spec, replacements);
}
var LOCKED_FIELD_NAMES, IncludeError;
var init_includeExpander = __esm({
  "src/spec/includeExpander.ts"() {
    "use strict";
    LOCKED_FIELD_NAMES = /* @__PURE__ */ new Set([
      "id",
      "version",
      "name",
      "type",
      "status",
      "priority",
      "schema_version"
    ]);
    IncludeError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "IncludeError";
      }
    };
  }
});

// src/check.ts
import { createHash as createHash2 } from "node:crypto";
import { readFileSync as readFileSync6, readdirSync as readdirSync2, statSync as statSync7 } from "node:fs";
import { dirname as dirname5, isAbsolute as isAbsolute2, join as join7, relative as relative6, resolve as resolvePath2 } from "node:path";
function isPlainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function asArray2(value) {
  return Array.isArray(value) ? value : [];
}
function isFile3(path) {
  try {
    return statSync7(path).isFile();
  } catch {
    return false;
  }
}
function isDirectory(path) {
  try {
    return statSync7(path).isDirectory();
  } catch {
    return false;
  }
}
function fileSha256(path) {
  return createHash2("sha256").update(readFileSync6(path)).digest("hex");
}
function loadYamlFile(path) {
  if (!isFile3(path)) {
    return null;
  }
  try {
    const parsed = (0, import_yaml4.parse)(readFileSync6(path, "utf-8"));
    return isPlainObject5(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function walkFiles(root) {
  const out = [];
  let entries;
  try {
    entries = readdirSync2(root);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join7(root, name);
    let stat;
    try {
      stat = statSync7(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}
function checkGenerated(_harnessDir, harnessYaml) {
  const findings = [];
  if (harnessYaml === null) {
    findings.push({
      kind: "Generated",
      path: "harness.yaml",
      message: "harness.yaml \uBD80\uC7AC/\uB85C\uB4DC \uC2E4\uD328",
      severity: "error"
    });
    return findings;
  }
  for (const key of ["version", "generation"]) {
    if (!(key in harnessYaml)) {
      findings.push({
        kind: "Generated",
        path: `harness.yaml::${key}`,
        message: `\uD544\uC218 \uD0A4 \uB204\uB77D: ${key}`,
        severity: "error"
      });
    }
  }
  return findings;
}
function checkDerived(harnessDir, harnessYaml) {
  const findings = [];
  const generation = isPlainObject5(harnessYaml["generation"]) ? harnessYaml["generation"] : {};
  const derived = isPlainObject5(generation["derived_from"]) ? generation["derived_from"] : {};
  const mapping = [
    ["domain_md", "domain.md"],
    ["architecture_yaml", "architecture.yaml"]
  ];
  for (const [key, filename] of mapping) {
    const entry = isPlainObject5(derived[key]) ? derived[key] : {};
    const expected = entry["output_hash"];
    const path = join7(harnessDir, filename);
    if (!isFile3(path)) {
      if (typeof expected === "string" && expected.length > 0) {
        findings.push({
          kind: "Derived",
          path: filename,
          message: `${filename} \uAE30\uB85D\uB41C \uD574\uC2DC \uC788\uC73C\uB098 \uD30C\uC77C \uC5C6\uC74C`,
          severity: "error"
        });
      }
      continue;
    }
    if (typeof expected !== "string" || expected.length === 0) {
      findings.push({
        kind: "Derived",
        path: filename,
        message: `${filename} \uC874\uC7AC\uD558\uC9C0\uB9CC output_hash \uBBF8\uAE30\uB85D (sync \uD544\uC694)`,
        severity: "warn"
      });
      continue;
    }
    const actual = fileSha256(path);
    if (actual !== expected) {
      findings.push({
        kind: "Derived",
        path: filename,
        message: `${filename} \uD574\uC2DC \uBD88\uC77C\uCE58 (edit-wins \uAC10\uC9C0) \u2014 sync --force \uB85C \uC7AC\uC0DD\uC131 or \uC218\uB3D9 \uC218\uC815 reconcile \uD544\uC694`,
        severity: "warn"
      });
    }
  }
  return findings;
}
function checkSpec(harnessDir, harnessYaml) {
  const findings = [];
  const specPath = join7(harnessDir, "spec.yaml");
  if (!isFile3(specPath)) {
    findings.push({
      kind: "Spec",
      path: "spec.yaml",
      message: "spec.yaml \uBD80\uC7AC",
      severity: "error"
    });
    return findings;
  }
  const generation = isPlainObject5(harnessYaml["generation"]) ? harnessYaml["generation"] : {};
  const generatedFrom = isPlainObject5(generation["generated_from"]) ? generation["generated_from"] : {};
  const expected = generatedFrom["spec_hash"];
  if (typeof expected !== "string" || expected.length === 0) {
    findings.push({
      kind: "Spec",
      path: "spec.yaml",
      message: "harness.yaml \uC5D0 spec_hash \uBBF8\uAE30\uB85D (sync \uD544\uC694)",
      severity: "warn"
    });
    return findings;
  }
  let parsed;
  try {
    parsed = (0, import_yaml4.parse)(readFileSync6(specPath, "utf-8"));
  } catch {
    parsed = {};
  }
  const actual = canonicalHash(parsed ?? {});
  if (actual !== expected) {
    findings.push({
      kind: "Spec",
      path: "spec.yaml",
      message: `spec \uBCC0\uACBD \uAC10\uC9C0 \u2014 sync \uD544\uC694 (expected=${expected.slice(0, 12)}, actual=${actual.slice(0, 12)})`,
      severity: "warn"
    });
  }
  return findings;
}
function checkIncludes(harnessDir, harnessYaml) {
  const findings = [];
  const generation = isPlainObject5(harnessYaml["generation"]) ? harnessYaml["generation"] : {};
  const recorded = asArray2(generation["include_sources"]).filter(
    (x) => typeof x === "string"
  );
  const specPath = join7(harnessDir, "spec.yaml");
  let current2 = [];
  if (isFile3(specPath)) {
    try {
      const parsed = (0, import_yaml4.parse)(readFileSync6(specPath, "utf-8"));
      if (isPlainObject5(parsed)) {
        current2 = findIncludes(parsed).map((item) => item.target);
      }
    } catch {
      current2 = [];
    }
  }
  const recSet = new Set(recorded);
  const curSet = new Set(current2);
  const removed = [...recSet].filter((x) => !curSet.has(x)).sort();
  const added = [...curSet].filter((x) => !recSet.has(x)).sort();
  for (const item of added) {
    findings.push({
      kind: "Include",
      path: item,
      message: `spec \uC5D0 \uC2E0\uADDC $include \uAC10\uC9C0 (sync \uD544\uC694): ${item}`,
      severity: "warn"
    });
  }
  for (const item of removed) {
    findings.push({
      kind: "Include",
      path: item,
      message: `harness.yaml \uC5D0 \uAE30\uB85D\uB41C include \uAC00 spec \uC5D0\uC11C \uC0AC\uB77C\uC9D0: ${item}`,
      severity: "warn"
    });
  }
  const chaptersDir = join7(harnessDir, "chapters");
  if (isDirectory(chaptersDir)) {
    for (const target of current2) {
      if (!isFile3(join7(chaptersDir, target))) {
        findings.push({
          kind: "Include",
          path: target,
          message: `$include \uD0C0\uAC9F \uD30C\uC77C \uC5C6\uC74C: chapters/${target}`,
          severity: "error"
        });
      }
    }
  }
  return findings;
}
function checkEvidence(harnessDir) {
  const findings = [];
  const statePath = join7(harnessDir, "state.yaml");
  if (!isFile3(statePath)) {
    return findings;
  }
  const state = State.load(harnessDir);
  for (const f of state.data.features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    if (f["status"] === "done" && (!Array.isArray(f["evidence"]) || f["evidence"].length === 0)) {
      const fid = typeof f["id"] === "string" ? f["id"] : "?";
      findings.push({
        kind: "Evidence",
        path: fid,
        message: `\uD53C\uCC98 ${fid} \uAC00 done \uC774\uC9C0\uB9CC evidence \uBBF8\uAE30\uB85D (BR-004 \uAC00\uC774\uB4DC)`,
        severity: "warn"
      });
    }
  }
  return findings;
}
function checkCode(harnessDir, spec, projectRoot = null) {
  const findings = [];
  const root = projectRoot ?? resolvePath2(harnessDir, "..");
  const features = asArray2(spec["features"]);
  for (const f of features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    const modules = asArray2(f["modules"]);
    for (const m of modules) {
      if (!isPlainObject5(m)) {
        continue;
      }
      const src = m["source"];
      if (typeof src !== "string" || src.trim().length === 0) {
        continue;
      }
      const target = resolvePath2(root, src);
      if (!isFile3(target)) {
        const name = typeof m["name"] === "string" ? m["name"] : "?";
        findings.push({
          kind: "Code",
          path: `${fid}::${name}`,
          message: `\uBAA8\uB4C8 '${name}' \uC758 source \uACBD\uB85C \uBD80\uC7AC: ${src}`,
          severity: "error"
        });
      }
    }
  }
  return findings;
}
function checkDoc(harnessDir, projectRoot = null) {
  const findings = [];
  const root = projectRoot ?? resolvePath2(harnessDir, "..");
  const claudeMd = join7(root, "CLAUDE.md");
  if (isFile3(claudeMd)) {
    let text = "";
    try {
      text = readFileSync6(claudeMd, "utf-8");
    } catch {
      text = "";
    }
    let match;
    CLAUDE_IMPORT_PATTERN.lastIndex = 0;
    while ((match = CLAUDE_IMPORT_PATTERN.exec(text)) !== null) {
      const rel = match[1].trim().replace(/[.,;:)]+$/, "");
      if (!rel || rel.startsWith("http://") || rel.startsWith("https://")) {
        continue;
      }
      const target = isAbsolute2(rel) ? rel : resolvePath2(root, rel);
      try {
        statSync7(target);
      } catch {
        findings.push({
          kind: "Doc",
          path: `CLAUDE.md::@${rel}`,
          message: `CLAUDE.md @import \uD0C0\uAC9F \uBD80\uC7AC: ${rel}`,
          severity: "warn"
        });
      }
    }
  }
  for (const fname of ["domain.md", "architecture.yaml"]) {
    const path = join7(harnessDir, fname);
    if (isFile3(path)) {
      try {
        if (statSync7(path).size === 0) {
          findings.push({
            kind: "Doc",
            path: fname,
            message: `${fname} \uD30C\uC77C\uC774 \uBE44\uC5B4\uC788\uC74C \u2014 sync \uC7AC\uC0DD\uC131 \uD544\uC694`,
            severity: "error"
          });
        }
      } catch {
      }
    }
  }
  return findings;
}
function checkAnchor(spec) {
  const findings = [];
  const features = asArray2(spec["features"]);
  const seen = /* @__PURE__ */ new Set();
  const allIds = /* @__PURE__ */ new Set();
  features.forEach((f, i) => {
    if (!isPlainObject5(f)) {
      findings.push({
        kind: "Anchor",
        path: `features[${i}]`,
        message: "feature \uD56D\uBAA9\uC774 \uB9E4\uD551\uC774 \uC544\uB2D8",
        severity: "error"
      });
      return;
    }
    const fid = f["id"];
    if (typeof fid !== "string" || fid.length === 0) {
      findings.push({
        kind: "Anchor",
        path: `features[${i}]`,
        message: "feature id \uB204\uB77D",
        severity: "error"
      });
      return;
    }
    if (!FEATURE_ID_PATTERN.test(fid)) {
      findings.push({
        kind: "Anchor",
        path: fid,
        message: `feature id \uAC00 F-NNN \uD328\uD134\uC774 \uC544\uB2D8 (got: '${fid}')`,
        severity: "error"
      });
    }
    if (seen.has(fid)) {
      findings.push({
        kind: "Anchor",
        path: fid,
        message: `\uC911\uBCF5 feature id: ${fid}`,
        severity: "error"
      });
    }
    seen.add(fid);
    allIds.add(fid);
  });
  for (const f of features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    const deps = f["depends_on"];
    if (deps === void 0 || deps === null) {
      continue;
    }
    if (!Array.isArray(deps)) {
      findings.push({
        kind: "Anchor",
        path: fid,
        message: "depends_on \uC774 \uBC30\uC5F4\uC774 \uC544\uB2D8",
        severity: "error"
      });
      continue;
    }
    for (const dep of deps) {
      if (typeof dep !== "string") {
        findings.push({
          kind: "Anchor",
          path: fid,
          message: `depends_on \uD56D\uBAA9\uC774 \uBB38\uC790\uC5F4 \uC544\uB2D8: ${JSON.stringify(dep)}`,
          severity: "error"
        });
        continue;
      }
      if (!allIds.has(dep)) {
        findings.push({
          kind: "Anchor",
          path: fid,
          message: `depends_on \uC5D0 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uD53C\uCC98 \uCC38\uC870: ${dep}`,
          severity: "error"
        });
      }
    }
  }
  findings.push(...checkFeatureSupersedes(features, allIds));
  return findings;
}
function checkFeatureSupersedes(features, allIds) {
  const findings = [];
  const supersedesMap = /* @__PURE__ */ new Map();
  for (const f of features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    const fid = f["id"];
    if (typeof fid !== "string" || fid.length === 0) {
      continue;
    }
    const sup = f["supersedes"];
    if (sup === void 0 || sup === null) {
      supersedesMap.set(fid, []);
    } else if (!Array.isArray(sup)) {
      findings.push({
        kind: "Anchor",
        path: fid,
        message: "supersedes \uAC00 \uBC30\uC5F4\uC774 \uC544\uB2D8",
        severity: "error"
      });
      supersedesMap.set(fid, []);
    } else {
      const cleaned = [];
      for (const target of sup) {
        if (typeof target !== "string") {
          findings.push({
            kind: "Anchor",
            path: fid,
            message: `supersedes \uD56D\uBAA9\uC774 \uBB38\uC790\uC5F4 \uC544\uB2D8: ${JSON.stringify(target)}`,
            severity: "error"
          });
          continue;
        }
        if (target === fid) {
          findings.push({
            kind: "Anchor",
            path: fid,
            message: `supersedes \uC5D0 \uC790\uAE30 \uC790\uC2E0 \uCC38\uC870 \uAE08\uC9C0: ${target}`,
            severity: "error"
          });
          continue;
        }
        if (!allIds.has(target)) {
          findings.push({
            kind: "Anchor",
            path: fid,
            message: `supersedes \uC5D0 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uD53C\uCC98 \uCC38\uC870: ${target}`,
            severity: "error"
          });
          continue;
        }
        cleaned.push(target);
      }
      supersedesMap.set(fid, cleaned);
    }
    const sb = f["superseded_by"];
    if (sb !== void 0 && sb !== null) {
      if (typeof sb !== "string") {
        findings.push({
          kind: "Anchor",
          path: fid,
          message: `superseded_by \uAC00 \uBB38\uC790\uC5F4 \uC544\uB2D8: ${JSON.stringify(sb)}`,
          severity: "error"
        });
      } else if (sb === fid) {
        findings.push({
          kind: "Anchor",
          path: fid,
          message: `superseded_by \uC5D0 \uC790\uAE30 \uC790\uC2E0 \uCC38\uC870 \uAE08\uC9C0: ${sb}`,
          severity: "error"
        });
      } else if (!allIds.has(sb)) {
        findings.push({
          kind: "Anchor",
          path: fid,
          message: `superseded_by \uC5D0 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uD53C\uCC98 \uCC38\uC870: ${sb}`,
          severity: "error"
        });
      }
    }
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = /* @__PURE__ */ new Map();
  for (const fid of supersedesMap.keys()) {
    color.set(fid, WHITE);
  }
  const visit = (node, stack) => {
    color.set(node, GRAY);
    for (const nxt of supersedesMap.get(node) ?? []) {
      const c = color.get(nxt);
      if (c === GRAY) {
        const cycle = [...stack, node, nxt];
        findings.push({
          kind: "Anchor",
          path: node,
          message: `supersedes \uC21C\uD658 \uAC10\uC9C0: ${cycle.join(" \u2192 ")}`,
          severity: "error"
        });
        continue;
      }
      if (c === WHITE) {
        visit(nxt, [...stack, node]);
      }
    }
    color.set(node, BLACK);
  };
  for (const fid of supersedesMap.keys()) {
    if (color.get(fid) === WHITE) {
      visit(fid, []);
    }
  }
  const byId = /* @__PURE__ */ new Map();
  for (const f of features) {
    if (isPlainObject5(f) && typeof f["id"] === "string") {
      byId.set(f["id"], f);
    }
  }
  for (const [fid, feat] of byId.entries()) {
    const sb = feat["superseded_by"];
    if (typeof sb !== "string" || !byId.has(sb)) {
      continue;
    }
    const targetSup = asArray2(byId.get(sb)["supersedes"]);
    if (!targetSup.includes(fid)) {
      findings.push({
        kind: "Anchor",
        path: fid,
        message: `${fid}.superseded_by=${sb} \uC774\uC9C0\uB9CC ${sb}.supersedes \uC5D0 ${fid} \uC5C6\uC74C \u2014 \uC591\uBC29\uD5A5 \uBD88\uC77C\uCE58`,
        severity: "warn"
      });
    }
  }
  return findings;
}
function checkAdrSupersedes(spec) {
  const findings = [];
  const decisions = asArray2(spec["decisions"]);
  if (decisions.length === 0) {
    return findings;
  }
  const byId = /* @__PURE__ */ new Map();
  for (const d of decisions) {
    if (isPlainObject5(d) && typeof d["id"] === "string") {
      byId.set(d["id"], d);
    }
  }
  for (const d of decisions) {
    if (!isPlainObject5(d)) {
      continue;
    }
    const newId = typeof d["id"] === "string" ? d["id"] : "?";
    const supersedes = asArray2(d["supersedes"]);
    for (const target of supersedes) {
      if (typeof target !== "string") {
        continue;
      }
      const targetD = byId.get(target);
      if (targetD === void 0) {
        findings.push({
          kind: "Adr",
          path: newId,
          message: `supersedes \uC5D0 \uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 ADR \uCC38\uC870: ${target} (decisions[] \uC5D0 \uC5C6\uC74C)`,
          severity: "warn"
        });
        continue;
      }
      const status = targetD["status"];
      if (status !== "superseded") {
        findings.push({
          kind: "Adr",
          path: target,
          message: `${newId} \uAC00 ${target} \uB97C supersedes \uD558\uB098 ${target}.status=${JSON.stringify(status)} \u2014 'superseded' \uB85C \uAC31\uC2E0 \uD544\uC694`,
          severity: "warn"
        });
      }
    }
  }
  return findings;
}
function checkProtocol(harnessDir) {
  const findings = [];
  const protoDir = join7(harnessDir, "protocols");
  if (!isDirectory(protoDir)) {
    return findings;
  }
  let entries;
  try {
    entries = readdirSync2(protoDir).sort();
  } catch {
    return findings;
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) {
      continue;
    }
    const md = join7(protoDir, name);
    let text;
    try {
      text = readFileSync6(md, "utf-8");
    } catch {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: "\uD30C\uC77C \uC77D\uAE30 \uC2E4\uD328",
        severity: "error"
      });
      continue;
    }
    const match = PROTOCOL_FRONTMATTER.exec(text);
    if (match === null) {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: "YAML frontmatter \uBD80\uC7AC \u2014 `---` \uB85C \uC2DC\uC791/\uC885\uB8CC\uB418\uB294 \uBE14\uB85D \uD544\uC694",
        severity: "error"
      });
      continue;
    }
    let fm;
    try {
      fm = (0, import_yaml4.parse)(match[1]);
    } catch (err) {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: `frontmatter YAML \uD30C\uC2F1 \uC2E4\uD328: ${err.message}`,
        severity: "error"
      });
      continue;
    }
    if (!isPlainObject5(fm)) {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: "frontmatter \uAC00 mapping \uC774 \uC544\uB2D8",
        severity: "error"
      });
      continue;
    }
    const pid = fm["protocol_id"];
    if (typeof pid !== "string" || pid.length === 0) {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: "frontmatter.protocol_id \uB204\uB77D \uB610\uB294 \uBE48 \uAC12",
        severity: "error"
      });
      continue;
    }
    const expected = name.replace(/\.md$/, "");
    if (pid !== expected) {
      findings.push({
        kind: "Protocol",
        path: relative6(harnessDir, md),
        message: `protocol_id ('${pid}') \uAC00 \uD30C\uC77C\uBA85 stem ('${expected}') \uACFC \uBD88\uC77C\uCE58 \u2014 F-017 AC-2 \uC704\uBC18`,
        severity: "error"
      });
    }
  }
  return findings;
}
function checkStale(harnessDir, spec, projectRoot = null) {
  const findings = [];
  const root = projectRoot ?? resolvePath2(harnessDir, "..");
  const features = asArray2(spec["features"]);
  const srcRoot = join7(root, "src");
  if (!isDirectory(srcRoot)) {
    return findings;
  }
  const srcFiles = walkFiles(srcRoot);
  for (const f of features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    if (f["status"] !== "done") {
      continue;
    }
    if (f["superseded_by"]) {
      continue;
    }
    const modules = asArray2(f["modules"]);
    const declaredSources = [];
    for (const m of modules) {
      if (!isPlainObject5(m)) {
        continue;
      }
      const src = m["source"];
      if (typeof src !== "string" || src.trim().length === 0) {
        continue;
      }
      const target = resolvePath2(root, src);
      if (isFile3(target)) {
        declaredSources.push(target);
      }
    }
    if (declaredSources.length === 0) {
      continue;
    }
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    for (const target of declaredSources) {
      const base = target.split(/[/\\]/).pop();
      const stem = base.replace(/\.[^.]+$/, "");
      let referenced = false;
      for (const sf of srcFiles) {
        if (sf === target) {
          continue;
        }
        let text;
        try {
          text = readFileSync6(sf, "utf-8");
        } catch {
          continue;
        }
        if (text.includes(base)) {
          referenced = true;
          break;
        }
        if (text.includes(`/${stem}`) || text.includes(`"${stem}`) || text.includes(`'${stem}`)) {
          referenced = true;
          break;
        }
      }
      if (!referenced) {
        let relStr;
        try {
          relStr = relative6(root, target);
        } catch {
          relStr = base;
        }
        findings.push({
          kind: "Stale",
          path: `${fid}::${relStr}`,
          message: `\uD53C\uCC98 ${fid} (status=done) \uC758 \uBAA8\uB4C8 ${relStr} \uAC00 src/ \uC5B4\uB514\uC5D0\uC11C\uB3C4 \uCC38\uC870\uB418\uC9C0 \uC54A\uC74C \u2014 \uC2E4\uC81C\uB85C \uC0AC\uC6A9\uB418\uC9C0 \uC54A\uB294 dead code \uAC70\uB098 archived/superseded_by \uCC98\uB9AC\uAC00 \uD544\uC694`,
          severity: "warn"
        });
      }
    }
  }
  return findings;
}
function checkAnchorIntegration(harnessDir, spec, projectRoot = null) {
  const findings = [];
  const root = projectRoot ?? resolvePath2(harnessDir, "..");
  const features = asArray2(spec["features"]);
  for (const f of features) {
    if (!isPlainObject5(f)) {
      continue;
    }
    if (f["status"] !== "done") {
      continue;
    }
    if (f["superseded_by"]) {
      continue;
    }
    const anchors = f["integration_anchor"];
    if (!Array.isArray(anchors) || anchors.length === 0) {
      continue;
    }
    const modules = asArray2(f["modules"]);
    const declaredSources = [];
    for (const m of modules) {
      if (!isPlainObject5(m)) {
        continue;
      }
      const src = m["source"];
      if (typeof src !== "string" || src.trim().length === 0) {
        continue;
      }
      const target = resolvePath2(root, src);
      if (isFile3(target)) {
        declaredSources.push(target);
      }
    }
    if (declaredSources.length === 0) {
      continue;
    }
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    const anchorPaths = [];
    for (const anchor of anchors) {
      if (typeof anchor !== "string" || anchor.trim().length === 0) {
        continue;
      }
      const ap = resolvePath2(root, anchor);
      if (!isFile3(ap)) {
        findings.push({
          kind: "AnchorIntegration",
          path: `${fid}::${anchor}`,
          message: `\uD53C\uCC98 ${fid} \uC758 integration_anchor \uD30C\uC77C \uBD80\uC7AC: ${anchor}`,
          severity: "error"
        });
        continue;
      }
      anchorPaths.push(ap);
    }
    if (anchorPaths.length === 0) {
      continue;
    }
    const anchorRels = anchorPaths.map((p) => {
      try {
        return relative6(root, p);
      } catch {
        return p;
      }
    });
    const anchorList = anchorRels.join(", ");
    for (const target of declaredSources) {
      const base = target.split(/[/\\]/).pop();
      const stem = base.replace(/\.[^.]+$/, "");
      let relStr;
      try {
        relStr = relative6(root, target);
      } catch {
        relStr = base;
      }
      let referenced = false;
      for (const ap of anchorPaths) {
        let text;
        try {
          text = readFileSync6(ap, "utf-8");
        } catch {
          continue;
        }
        if (text.includes(base)) {
          referenced = true;
          break;
        }
        if (text.includes(`/${stem}`) || text.includes(`"${stem}`) || text.includes(`'${stem}`)) {
          referenced = true;
          break;
        }
      }
      if (!referenced) {
        findings.push({
          kind: "AnchorIntegration",
          path: `${fid}::${relStr}`,
          message: `\uD53C\uCC98 ${fid} (status=done) \uC758 \uBAA8\uB4C8 ${relStr} \uAC00 integration_anchor (${anchorList}) \uC5D0\uC11C \uCC38\uC870\uB418\uC9C0 \uC54A\uC74C \u2014 \uD1B5\uD569 wiring \uB204\uB77D \uAC00\uB2A5\uC131`,
          severity: "warn"
        });
      }
    }
  }
  return findings;
}
function checkSpecCoverage(harnessDir, _specYaml) {
  const findings = [];
  const covDir = join7(harnessDir, "_workspace", "coverage");
  if (!isDirectory(covDir)) {
    return findings;
  }
  let threshold = DEFAULT_COVERAGE_THRESHOLD;
  const harnessYamlPath = join7(harnessDir, "harness.yaml");
  if (isFile3(harnessYamlPath)) {
    try {
      const cfg = (0, import_yaml4.parse)(readFileSync6(harnessYamlPath, "utf-8"));
      if (isPlainObject5(cfg)) {
        const coverage = cfg["coverage"];
        if (isPlainObject5(coverage)) {
          const override = coverage["threshold"];
          if (typeof override === "number") {
            threshold = override;
          } else if (typeof override === "string" && !Number.isNaN(Number(override))) {
            threshold = Number(override);
          }
        }
      }
    } catch {
      threshold = DEFAULT_COVERAGE_THRESHOLD;
    }
  }
  let entries;
  try {
    entries = readdirSync2(covDir).sort();
  } catch {
    return findings;
  }
  for (const name of entries) {
    if (!name.startsWith("F-") || !name.endsWith(".yaml")) {
      continue;
    }
    const fpPath = join7(covDir, name);
    let fp;
    try {
      fp = (0, import_yaml4.parse)(readFileSync6(fpPath, "utf-8"));
    } catch {
      continue;
    }
    if (!isPlainObject5(fp)) {
      continue;
    }
    const fid = fp["feature_id"] ?? name.replace(/\.yaml$/, "");
    const mismatches = asArray2(fp["mismatches"]);
    for (const mismatch of mismatches) {
      if (!isPlainObject5(mismatch)) {
        continue;
      }
      const metric = typeof mismatch["metric"] === "string" ? mismatch["metric"] : "";
      const descVal = Number(mismatch["description_value"] ?? 0);
      const acVal = Number(mismatch["ac_value"] ?? 0);
      if (Number.isNaN(descVal) || Number.isNaN(acVal) || descVal <= 0) {
        continue;
      }
      const ratio = acVal / descVal;
      if (ratio < threshold) {
        findings.push({
          kind: "Coverage",
          path: `${fid}::quant.${metric}`,
          message: `description claims ${descVal} ${metric} but AC accepts ${acVal} (ratio=${ratio.toFixed(2)}, threshold=${threshold.toFixed(2)}) \u2014 explicit carry-forward required (retro entry or --hotfix-reason)`,
          severity: "error"
        });
      }
    }
  }
  return findings;
}
function runCheck(harnessDir, projectRoot = null) {
  const report = { findings: [], checked: [] };
  const harnessYaml = loadYamlFile(join7(harnessDir, "harness.yaml"));
  const specYaml = loadYamlFile(join7(harnessDir, "spec.yaml"));
  report.findings.push(...checkGenerated(harnessDir, harnessYaml));
  report.checked.push("Generated");
  if (harnessYaml !== null) {
    report.findings.push(...checkDerived(harnessDir, harnessYaml));
    report.checked.push("Derived");
    report.findings.push(...checkSpec(harnessDir, harnessYaml));
    report.checked.push("Spec");
    report.findings.push(...checkIncludes(harnessDir, harnessYaml));
    report.checked.push("Include");
  }
  report.findings.push(...checkEvidence(harnessDir));
  report.checked.push("Evidence");
  if (specYaml !== null) {
    report.findings.push(...checkCode(harnessDir, specYaml, projectRoot));
    report.checked.push("Code");
    report.findings.push(...checkAnchor(specYaml));
    report.checked.push("Anchor");
    report.findings.push(...checkAdrSupersedes(specYaml));
    report.checked.push("Adr");
    report.findings.push(...checkStale(harnessDir, specYaml, projectRoot));
    report.checked.push("Stale");
    report.findings.push(...checkAnchorIntegration(harnessDir, specYaml, projectRoot));
    report.checked.push("AnchorIntegration");
  }
  report.findings.push(...checkDoc(harnessDir, projectRoot));
  report.checked.push("Doc");
  report.findings.push(...checkProtocol(harnessDir));
  report.checked.push("Protocol");
  report.findings.push(...checkSpecCoverage(harnessDir, specYaml));
  report.checked.push("Coverage");
  return report;
}
function runBlockingCheck(harnessDir, projectRoot = null) {
  const report = { findings: [], checked: [] };
  const specYaml = loadYamlFile(join7(harnessDir, "spec.yaml"));
  if (specYaml !== null) {
    report.findings.push(...checkCode(harnessDir, specYaml, projectRoot));
    report.findings.push(...checkStale(harnessDir, specYaml, projectRoot));
    report.findings.push(...checkAnchorIntegration(harnessDir, specYaml, projectRoot));
  }
  report.findings.push(...checkSpecCoverage(harnessDir, specYaml));
  report.checked.push("Code", "Stale", "AnchorIntegration", "Coverage");
  return report;
}
function formatHuman(report) {
  const lines = ["\u{1F50D} /harness:check", ""];
  lines.push(`Checked: ${report.checked.join(", ")}`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("\u2705 clean \u2014 drift \uC5C6\uC74C");
    return `${lines.join("\n")}
`;
  }
  lines.push(`Findings (${report.findings.length}):`);
  for (const f of report.findings) {
    const marker = f.severity === "error" ? "\u274C" : "\u26A0\uFE0F ";
    lines.push(`  ${marker} [${f.kind}] ${f.path}: ${f.message}`);
  }
  void dirname5;
  return `${lines.join("\n")}
`;
}
var import_yaml4, FEATURE_ID_PATTERN, CLAUDE_IMPORT_PATTERN, PROTOCOL_FRONTMATTER, DEFAULT_COVERAGE_THRESHOLD;
var init_check = __esm({
  "src/check.ts"() {
    "use strict";
    import_yaml4 = __toESM(require_dist(), 1);
    init_canonicalHash();
    init_state();
    init_includeExpander();
    FEATURE_ID_PATTERN = /^F-\d+$/;
    CLAUDE_IMPORT_PATTERN = /^@([^\s]+)/gm;
    PROTOCOL_FRONTMATTER = /^---\s*\n([\s\S]*?)\n---/;
    DEFAULT_COVERAGE_THRESHOLD = 0.8;
  }
});

// src/core/gates.ts
var STANDARD_GATES;
var init_gates = __esm({
  "src/core/gates.ts"() {
    "use strict";
    STANDARD_GATES = [
      "gate_0",
      "gate_1",
      "gate_2",
      "gate_3",
      "gate_4",
      "gate_5"
    ];
  }
});

// src/ui/intentPlanner.ts
function isPlainObject9(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function asArray4(value) {
  return Array.isArray(value) ? value : [];
}
function featureTitle2(fid, spec) {
  if (!isPlainObject9(spec)) {
    return fid;
  }
  for (const f of asArray4(spec["features"])) {
    if (isPlainObject9(f) && f["id"] === fid) {
      const title = f["name"] ?? f["title"];
      if (typeof title === "string" && title.trim().length > 0) {
        return title.trim();
      }
    }
  }
  return fid;
}
function hasRecentBlocker(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return false;
  }
  const last = evidence[evidence.length - 1];
  return isPlainObject9(last) && last["kind"] === "blocker";
}
function suggestionsForActive(feature, spec) {
  const fid = typeof feature["id"] === "string" ? feature["id"] : "?";
  const status = typeof feature["status"] === "string" ? feature["status"] : "planned";
  const gates = isPlainObject9(feature["gates"]) ? feature["gates"] : {};
  const evidence = asArray4(feature["evidence"]);
  const title = featureTitle2(fid, spec);
  if (status === "blocked" || hasRecentBlocker(evidence)) {
    return [
      { label: `\uCC28\uB2E8 \uD574\uACB0 \uC2DC\uB3C4: "${title}"`, action: "resolve_block", feature_id: fid },
      { label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }
    ];
  }
  const failed = [];
  for (const [name, g] of Object.entries(gates)) {
    if (isPlainObject9(g) && g["last_result"] === "fail") {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    const ordered = STANDARD_GATES2.filter((g) => failed.includes(g));
    const first = ordered.length > 0 ? ordered[0] : [...failed].sort()[0];
    return [
      { label: `\uC2E4\uD328 \uC6D0\uC778 \uBD84\uC11D: ${first}`, action: "analyze_fail", feature_id: fid, gate: first },
      { label: `${first} \uC7AC\uC2E4\uD589`, action: "run_gate", feature_id: fid, gate: first },
      { label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }
    ];
  }
  let nextGate = null;
  for (const gateName of STANDARD_GATES2) {
    const g = gates[gateName];
    const result = isPlainObject9(g) ? g["last_result"] : null;
    if (result !== "pass") {
      nextGate = gateName;
      break;
    }
  }
  const gate5 = gates["gate_5"];
  const gate5Pass = isPlainObject9(gate5) && gate5["last_result"] === "pass";
  if (gate5Pass && nextGate === null) {
    if (evidence.length === 0) {
      return [
        { label: `\uADFC\uAC70 1 \uAC74 \uCD94\uAC00 ("${title}")`, action: "add_evidence", feature_id: fid },
        { label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }
      ];
    }
    return [
      { label: `\uC644\uB8CC \uCC98\uB9AC: "${title}"`, action: "complete", feature_id: fid },
      { label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }
    ];
  }
  if (nextGate !== null) {
    return [
      { label: `\uAC80\uC99D \uC2E4\uD589: ${nextGate}`, action: "run_gate", feature_id: fid, gate: nextGate },
      { label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }
    ];
  }
  return [{ label: "\uB2E4\uB978 \uC791\uC5C5\uC73C\uB85C \uC804\uD658", action: "deactivate" }];
}
function firstUnregisteredInSpec(features, spec) {
  if (!isPlainObject9(spec)) {
    return null;
  }
  const specFeatures = asArray4(spec["features"]);
  if (specFeatures.length === 0) {
    return null;
  }
  const registered = /* @__PURE__ */ new Set();
  for (const f of features) {
    if (isPlainObject9(f) && typeof f["id"] === "string") {
      registered.add(f["id"]);
    }
  }
  for (const f of specFeatures) {
    if (!isPlainObject9(f)) {
      continue;
    }
    const fid = f["id"];
    if (typeof fid !== "string" || fid.length === 0) {
      continue;
    }
    if (registered.has(fid)) {
      continue;
    }
    if (f["status"] === "archived") {
      continue;
    }
    if (f["superseded_by"]) {
      continue;
    }
    return fid;
  }
  return null;
}
function suggestionsForIdle(features, spec) {
  const inProgress = features.filter(
    (f) => isPlainObject9(f) && f["status"] === "in_progress" && typeof f["id"] === "string"
  );
  const planned = features.filter(
    (f) => isPlainObject9(f) && f["status"] === "planned" && typeof f["id"] === "string"
  );
  const out = [];
  if (inProgress.length > 0) {
    const fid = inProgress[0]["id"];
    out.push({
      label: `\uC774\uC5B4\uC11C \uC791\uC5C5: "${featureTitle2(fid, spec)}"`,
      action: "resume",
      feature_id: fid
    });
  }
  if (planned.length > 0) {
    const fid = planned[0]["id"];
    out.push({
      label: `\uB2E4\uC74C \uD53C\uCC98 \uC2DC\uC791: "${featureTitle2(fid, spec)}"`,
      action: "start_feature",
      feature_id: fid
    });
  } else {
    const unregisteredFid = firstUnregisteredInSpec(features, spec);
    if (unregisteredFid !== null) {
      out.push({
        label: `\uB2E4\uC74C \uD53C\uCC98 \uC2DC\uC791: "${featureTitle2(unregisteredFid, spec)}"`,
        action: "start_feature",
        feature_id: unregisteredFid
      });
    }
  }
  if (out.length === 0) {
    out.push({ label: "\uC0C8 \uD53C\uCC98 \uB4F1\uB85D (spec.yaml \uD3B8\uC9D1)", action: "init_feature" });
  }
  return out;
}
function suggest(stateData, spec = null, options = {}) {
  if (!isPlainObject9(stateData)) {
    return [];
  }
  const session = isPlainObject9(stateData["session"]) ? stateData["session"] : {};
  const activeId = session["active_feature_id"];
  const features = asArray4(stateData["features"]);
  const byId = /* @__PURE__ */ new Map();
  for (const f of features) {
    if (isPlainObject9(f) && typeof f["id"] === "string") {
      byId.set(f["id"], f);
    }
  }
  let out;
  if (typeof activeId === "string" && byId.has(activeId)) {
    out = suggestionsForActive(byId.get(activeId), spec);
  } else {
    out = suggestionsForIdle(features, spec);
  }
  const coverage = options.coverage;
  if (coverage !== void 0 && coverage !== null && coverage < DEFAULT_COVERAGE_THRESHOLD3) {
    const pct = Math.round(coverage * 100);
    const thresholdPct = Math.round(DEFAULT_COVERAGE_THRESHOLD3 * 100);
    out = [
      {
        label: `Review carry-forward debt \u2014 coverage ${pct}% < threshold ${thresholdPct}% (explicit carry to retro before complete)`,
        action: "review_carry_forward"
      },
      ...out
    ];
  }
  return out.slice(0, 3);
}
var STANDARD_GATES2, DEFAULT_COVERAGE_THRESHOLD3;
var init_intentPlanner = __esm({
  "src/ui/intentPlanner.ts"() {
    "use strict";
    STANDARD_GATES2 = [
      "gate_0",
      "gate_1",
      "gate_2",
      "gate_3",
      "gate_4",
      "gate_5"
    ];
    DEFAULT_COVERAGE_THRESHOLD3 = 0.8;
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors2 = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t2) => COERCIBLE.has(t2) || coerceTypes === "array" && t2 === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t2 of coerceTo) {
        if (COERCIBLE.has(t2) || t2 === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t2);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t2) {
        switch (t2) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t2 in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t2, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors2();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate2 = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate2);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors2();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t2) => {
        if (!includesType(it.dataTypes, t2)) {
          strictTypesError(it, `type "${t2}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t2) => hasApplicableType(ts, t2))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t2) {
      return ts.includes(t2) || t2 === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t2 of it.dataTypes) {
        if (includesType(withTypes, t2))
          ts.push(t2);
        else if (withTypes.includes("integer") && t2 === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate2 = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate2 });
        validate2.errors = null;
        validate2.schema = sch.schema;
        validate2.schemaEnv = sch;
        if (sch.$async)
          validate2.$async = true;
        if (this.opts.code.source === true) {
          validate2.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate2.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate2.source)
            validate2.source.evaluated = (0, codegen_1.stringify)(validate2.evaluated);
        }
        sch.validate = validate2;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve2.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve2(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    function normalizeComponentEncoding(component, esc) {
      const func = esc !== true ? escape : unescape;
      if (component.scheme !== void 0) {
        component.scheme = func(component.scheme);
      }
      if (component.userinfo !== void 0) {
        component.userinfo = func(component.userinfo);
      }
      if (component.host !== void 0) {
        component.host = func(component.host);
      }
      if (component.path !== void 0) {
        component.path = func(component.path);
      }
      if (component.query !== void 0) {
        component.query = func(component.query);
      }
      if (component.fragment !== void 0) {
        component.fragment = func(component.fragment);
      }
      return component;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = component.host;
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      normalizeComponentEncoding,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizeComponentEncoding, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        serialize(parse(uri, options), options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve2(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative7, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative7 = parse(serialize(relative7, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative7.scheme) {
        target.scheme = relative7.scheme;
        target.userinfo = relative7.userinfo;
        target.host = relative7.host;
        target.port = relative7.port;
        target.path = removeDotSegments(relative7.path || "");
        target.query = relative7.query;
      } else {
        if (relative7.userinfo !== void 0 || relative7.host !== void 0 || relative7.port !== void 0) {
          target.userinfo = relative7.userinfo;
          target.host = relative7.host;
          target.port = relative7.port;
          target.path = removeDotSegments(relative7.path || "");
          target.query = relative7.query;
        } else {
          if (!relative7.path) {
            target.path = base.path;
            if (relative7.query !== void 0) {
              target.query = relative7.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative7.path[0] === "/") {
              target.path = removeDotSegments(relative7.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative7.path;
              } else if (!base.path) {
                target.path = relative7.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative7.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative7.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative7.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      if (typeof uriA === "string") {
        uriA = unescape(uriA);
        uriA = serialize(normalizeComponentEncoding(parse(uriA, options), true), { ...options, skipEscape: true });
      } else if (typeof uriA === "object") {
        uriA = serialize(normalizeComponentEncoding(uriA, true), { ...options, skipEscape: true });
      }
      if (typeof uriB === "string") {
        uriB = unescape(uriB);
        uriB = serialize(normalizeComponentEncoding(parse(uriB, options), true), { ...options, skipEscape: true });
      } else if (typeof uriB === "object") {
        uriB = serialize(normalizeComponentEncoding(uriB, true), { ...options, skipEscape: true });
      }
      return uriA.toLowerCase() === uriB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escape(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = unescape(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function parse(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = URL.domainToASCII(parsed.host.toLowerCase());
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = unescape(parsed.host);
            }
          }
          if (parsed.path) {
            parsed.path = escape(unescape(parsed.path));
          }
          if (parsed.fragment) {
            parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return parsed;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve2,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t2) => addRule.call(this, k, definition, t2)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t2 }) => t2 === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t2) => t2 === "object" || t2 === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block2) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block2();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate2 = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate2));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate2, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate2);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate2);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema4 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema4();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv, sch) {
        return $data ? ajv.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv2020 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv2020;
    module.exports = exports = Ajv2020;
    module.exports.Ajv2020 = Ajv2020;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv2020;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate2, compare) {
      return { validate: validate2, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module) {
    module.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv;
    module.exports = exports = Ajv;
    module.exports.Ajv = Ajv;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/limit.js
var require_limit = __commonJS({
  "node_modules/ajv-formats/dist/limit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatLimitDefinition = void 0;
    var ajv_1 = require_ajv();
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      formatMaximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      formatMinimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      formatExclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      formatExclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`should be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    exports.formatLimitDefinition = {
      keyword: Object.keys(KWDs),
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, keyword, it } = cxt;
        const { opts, self } = it;
        if (!opts.validateFormats)
          return;
        const fCxt = new ajv_1.KeywordCxt(it, self.RULES.all.format.definition, "format");
        if (fCxt.$data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fmt = gen.const("fmt", (0, codegen_1._)`${fmts}[${fCxt.schemaCode}]`);
          cxt.fail$data((0, codegen_1.or)((0, codegen_1._)`typeof ${fmt} != "object"`, (0, codegen_1._)`${fmt} instanceof RegExp`, (0, codegen_1._)`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
        }
        function validateFormat() {
          const format = fCxt.schema;
          const fmtDef = self.formats[format];
          if (!fmtDef || fmtDef === true)
            return;
          if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function") {
            throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
          }
          const fmt = gen.scopeValue("formats", {
            key: format,
            ref: fmtDef,
            code: opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(format)}` : void 0
          });
          cxt.fail$data(compareCode(fmt));
        }
        function compareCode(fmt) {
          return (0, codegen_1._)`${fmt}.compare(${data}, ${schemaCode}) ${KWDs[keyword].fail} 0`;
        }
      },
      dependencies: ["format"]
    };
    var formatLimitPlugin = (ajv) => {
      ajv.addKeyword(exports.formatLimitDefinition);
      return ajv;
    };
    exports.default = formatLimitPlugin;
  }
});

// node_modules/ajv-formats/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/ajv-formats/dist/index.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var formats_1 = require_formats();
    var limit_1 = require_limit();
    var codegen_1 = require_codegen();
    var fullName = new codegen_1.Name("fullFormats");
    var fastName = new codegen_1.Name("fastFormats");
    var formatsPlugin = (ajv, opts = { keywords: true }) => {
      if (Array.isArray(opts)) {
        addFormats2(ajv, opts, formats_1.fullFormats, fullName);
        return ajv;
      }
      const [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName];
      const list = opts.formats || formats_1.formatNames;
      addFormats2(ajv, list, formats, exportName);
      if (opts.keywords)
        (0, limit_1.default)(ajv);
      return ajv;
    };
    formatsPlugin.get = (name, mode = "full") => {
      const formats = mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats;
      const f = formats[name];
      if (!f)
        throw new Error(`Unknown format "${name}"`);
      return f;
    };
    function addFormats2(ajv, list, fs, exportName) {
      var _a;
      var _b;
      (_a = (_b = ajv.opts.code).formats) !== null && _a !== void 0 ? _a : _b.formats = (0, codegen_1._)`require("ajv-formats/dist/formats").${exportName}`;
      for (const f of list)
        ajv.addFormat(f, fs[f]);
    }
    module.exports = exports = formatsPlugin;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = formatsPlugin;
  }
});

// src/spec/validate.ts
import { readFileSync as readFileSync9, statSync as statSync10 } from "node:fs";
import { dirname as dirname6, join as join10, resolve as resolvePath3 } from "node:path";
import { fileURLToPath } from "node:url";
function defaultSchemaPath() {
  const repoRoot = resolvePath3(__dirname, "..", "..");
  return join10(repoRoot, "docs", "schemas", "spec.schema.json");
}
function getValidator(schemaPath) {
  const stat = statSync10(schemaPath);
  const mtime = stat.mtimeMs;
  if (ajvCache !== null && ajvCache.schemaPath === schemaPath && ajvCache.schemaMtime === mtime) {
    return ajvCache.fn;
  }
  const schemaText = readFileSync9(schemaPath, "utf-8");
  const schema = JSON.parse(schemaText);
  const ajv = new Ajv2020Ctor({ allErrors: false, strict: false });
  addFormats(ajv);
  const fn = ajv.compile(schema);
  ajvCache = { schemaPath, schemaMtime: mtime, fn };
  return fn;
}
function loadSpec(specPath) {
  let raw;
  try {
    raw = readFileSync9(specPath, "utf-8");
  } catch (err) {
    throw new SpecValidationError(
      `${specPath}: ${err.message}`,
      [],
      "read_error"
    );
  }
  let parsed;
  try {
    parsed = (0, import_yaml6.parse)(raw);
  } catch (err) {
    throw new SpecValidationError(
      `${specPath}: ${err.message}`,
      [],
      "yaml_parse"
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SpecValidationError(
      `${specPath}: top-level YAML must be a mapping`,
      [],
      "top_level"
    );
  }
  return parsed;
}
function formatPath(path) {
  if (path.length === 0) {
    return "(root)";
  }
  return path.map((p) => String(p)).join(".");
}
function ajvErrorToPath(err) {
  if (!err.instancePath) {
    return [];
  }
  return err.instancePath.split("/").filter((seg) => seg.length > 0).map((seg) => {
    const decoded = seg.replace(/~1/g, "/").replace(/~0/g, "~");
    const asNum = Number(decoded);
    if (Number.isInteger(asNum) && String(asNum) === decoded) {
      return asNum;
    }
    return decoded;
  });
}
function validate(spec, schemaPath = null) {
  const resolved = schemaPath ?? defaultSchemaPath();
  let isFile8;
  try {
    isFile8 = statSync10(resolved).isFile();
  } catch {
    isFile8 = false;
  }
  if (!isFile8) {
    throw new SpecValidationError(
      `\uC2A4\uD0A4\uB9C8 \uD30C\uC77C \uC5C6\uC74C: ${resolved}`,
      [],
      "missing_schema_file"
    );
  }
  const fn = getValidator(resolved);
  const ok = fn(spec);
  if (ok) {
    return;
  }
  const errors = fn.errors ?? [];
  if (errors.length === 0) {
    throw new SpecValidationError("schema validation failed (no error detail)", [], "unknown");
  }
  const first = errors[0];
  const path = ajvErrorToPath(first);
  const pathStr = formatPath(path);
  throw new SpecValidationError(
    `${pathStr}: ${first.message ?? "validation error"}`,
    path,
    first.keyword
  );
}
var import__, import_ajv_formats, import_yaml6, Ajv2020Ctor, addFormats, __filename, __dirname, SpecValidationError, ajvCache;
var init_validate = __esm({
  "src/spec/validate.ts"() {
    "use strict";
    import__ = __toESM(require__(), 1);
    import_ajv_formats = __toESM(require_dist2(), 1);
    import_yaml6 = __toESM(require_dist(), 1);
    Ajv2020Ctor = import__.default.default ?? import__.default;
    addFormats = import_ajv_formats.default.default ?? import_ajv_formats.default;
    __filename = fileURLToPath(import.meta.url);
    __dirname = dirname6(__filename);
    SpecValidationError = class extends Error {
      path;
      reason;
      constructor(message, path = [], reason = "") {
        super(message);
        this.name = "SpecValidationError";
        this.path = path;
        this.reason = reason;
      }
    };
    ajvCache = null;
  }
});

// src/core/pluginRoot.ts
import { existsSync as existsSync2, readFileSync as readFileSync11, realpathSync, statSync as statSync12 } from "node:fs";
import { homedir } from "node:os";
import { delimiter as pathDelimiter, join as join12, resolve as resolvePath4 } from "node:path";
function loadPluginJson(root) {
  const manifest = join12(root, ".claude-plugin", "plugin.json");
  try {
    if (!statSync12(manifest).isFile()) {
      return null;
    }
    const raw = readFileSync11(manifest, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function tryRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}
function isDirectory2(p) {
  try {
    return statSync12(p).isDirectory();
  } catch {
    return false;
  }
}
function _strategyPathBin(pluginName) {
  const pathEnv = process.env.PATH ?? "";
  for (const entry of pathEnv.split(pathDelimiter)) {
    if (!entry) {
      continue;
    }
    if (!entry.includes("/plugins/")) {
      continue;
    }
    const trimmed = entry.replace(/\/+$/, "");
    if (!trimmed.endsWith("/bin")) {
      continue;
    }
    const candidate = resolvePath4(entry, "..");
    const real = tryRealpath(candidate);
    if (real === null) {
      continue;
    }
    const manifest = loadPluginJson(real);
    if (manifest && manifest["name"] === pluginName) {
      return real;
    }
  }
  return null;
}
function _strategyRegistry(pluginName) {
  const registry = join12(homedir(), ".claude", "plugins", "installed_plugins.json");
  let parsed;
  try {
    if (!statSync12(registry).isFile()) {
      return null;
    }
    parsed = JSON.parse(readFileSync11(registry, "utf-8"));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const plugins = parsed["plugins"];
  if (plugins === null || typeof plugins !== "object" || Array.isArray(plugins)) {
    return null;
  }
  const prefix = `${pluginName}@`;
  for (const [key, entries] of Object.entries(plugins)) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      continue;
    }
    const head = entries[0];
    if (head === null || typeof head !== "object" || Array.isArray(head)) {
      continue;
    }
    const installPath = head["installPath"];
    if (typeof installPath !== "string" || installPath.length === 0) {
      continue;
    }
    const expanded = expandHome(installPath);
    if (isDirectory2(expanded)) {
      return tryRealpath(expanded) ?? expanded;
    }
  }
  return null;
}
function _strategyMarketplaceSource(pluginName) {
  const settings = join12(homedir(), ".claude", "settings.json");
  let parsed;
  try {
    if (!statSync12(settings).isFile()) {
      return null;
    }
    parsed = JSON.parse(readFileSync11(settings, "utf-8"));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const marketplaces = parsed["extraKnownMarketplaces"];
  if (marketplaces === null || typeof marketplaces !== "object" || Array.isArray(marketplaces)) {
    return null;
  }
  for (const mpDef of Object.values(marketplaces)) {
    if (mpDef === null || typeof mpDef !== "object" || Array.isArray(mpDef)) {
      continue;
    }
    const src = mpDef["source"];
    if (src === null || typeof src !== "object" || Array.isArray(src)) {
      continue;
    }
    if (src["source"] !== "directory") {
      continue;
    }
    const pathStr = src["path"];
    if (typeof pathStr !== "string" || pathStr.length === 0) {
      continue;
    }
    const mpRoot = expandHome(pathStr);
    if (!isDirectory2(mpRoot)) {
      continue;
    }
    const mpManifestPath = join12(mpRoot, ".claude-plugin", "marketplace.json");
    let mpData;
    try {
      if (!statSync12(mpManifestPath).isFile()) {
        continue;
      }
      mpData = JSON.parse(readFileSync11(mpManifestPath, "utf-8"));
    } catch {
      continue;
    }
    if (mpData === null || typeof mpData !== "object" || Array.isArray(mpData)) {
      continue;
    }
    const pluginEntries = mpData["plugins"];
    if (!Array.isArray(pluginEntries)) {
      continue;
    }
    for (const entry of pluginEntries) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }
      if (entry["name"] !== pluginName) {
        continue;
      }
      const pluginSrc = entry["source"] ?? "./";
      if (typeof pluginSrc !== "string") {
        continue;
      }
      const candidate = resolvePath4(mpRoot, pluginSrc);
      if (isDirectory2(candidate)) {
        return tryRealpath(candidate) ?? candidate;
      }
    }
  }
  return null;
}
function expandHome(p) {
  if (p === "~") {
    return homedir();
  }
  if (p.startsWith("~/")) {
    return join12(homedir(), p.slice(2));
  }
  return p;
}
function resolve(pluginName = "harness") {
  const attempts = [];
  let root = _strategyPathBin(pluginName);
  attempts.push(`A path-bin: ${root ? "hit" : "miss"}`);
  if (root) {
    return { root, strategy: "A:path-bin", attempts };
  }
  root = _strategyRegistry(pluginName);
  attempts.push(`B registry: ${root ? "hit" : "miss"}`);
  if (root) {
    return { root, strategy: "B:registry", attempts };
  }
  root = _strategyMarketplaceSource(pluginName);
  attempts.push(`C mp-source: ${root ? "hit" : "miss"}`);
  if (root) {
    return { root, strategy: "C:marketplace-source", attempts };
  }
  throw new PluginRootError(
    `\uD50C\uB7EC\uADF8\uC778 '${pluginName}' \uB8E8\uD2B8 \uD574\uC11D \uC2E4\uD328 \u2014 attempts: ${attempts.join(", ")}`
  );
}
var PluginRootError;
var init_pluginRoot = __esm({
  "src/core/pluginRoot.ts"() {
    "use strict";
    PluginRootError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "PluginRootError";
      }
    };
  }
});

// src/render/architecture.ts
function asArray5(value) {
  return Array.isArray(value) ? value : [];
}
function asObject2(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function nowIso5() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function buildModulesMap(features) {
  const owners = /* @__PURE__ */ new Map();
  for (const f of features) {
    const obj = asObject2(f);
    if (obj === null) {
      continue;
    }
    const fid = asString(obj["id"], "F-?");
    const mods = asArray5(obj["modules"]);
    for (const m of mods) {
      let name = null;
      if (typeof m === "string") {
        name = m;
      } else {
        const mObj = asObject2(m);
        if (mObj !== null && typeof mObj["name"] === "string") {
          name = mObj["name"];
        }
      }
      if (name === null) {
        continue;
      }
      if (!owners.has(name)) {
        owners.set(name, []);
      }
      owners.get(name).push(fid);
    }
  }
  const sorted = [...owners.keys()].sort();
  return sorted.map((name) => ({ name, owners: owners.get(name) }));
}
function buildFeatureGraph(features) {
  const out = [];
  for (const f of features) {
    const obj = asObject2(f);
    if (obj === null) {
      continue;
    }
    const entry = { id: asString(obj["id"], "F-?") };
    if (typeof obj["name"] === "string") {
      entry.name = obj["name"];
    }
    const mods = asArray5(obj["modules"]);
    const modNames = [];
    for (const m of mods) {
      if (typeof m === "string") {
        modNames.push(m);
      } else {
        const mObj = asObject2(m);
        if (mObj !== null && typeof mObj["name"] === "string") {
          modNames.push(mObj["name"]);
        }
      }
    }
    if (modNames.length > 0) {
      entry.modules = modNames;
    }
    const deps = asArray5(obj["depends_on"]);
    if (deps.length > 0) {
      entry.depends_on = [...deps];
    }
    const status = asString(obj["status"]);
    if (status) {
      entry.status = status;
    }
    out.push(entry);
  }
  return out;
}
function render2(spec, options = {}) {
  const timestamp = options.timestamp ?? nowIso5();
  const sourceRef = options.sourceRef ?? "spec.yaml";
  const out = {};
  out["version"] = asString(spec["version"], "2.3");
  out["generated_at"] = timestamp;
  out["from_spec"] = sourceRef;
  const constraints = asObject2(spec["constraints"]);
  const techStack = constraints !== null ? asObject2(constraints["tech_stack"]) : null;
  if (techStack !== null && Object.keys(techStack).length > 0) {
    out["tech_stack"] = techStack;
  }
  const deliverable = asObject2(spec["deliverable"]);
  if (deliverable !== null && Object.keys(deliverable).length > 0) {
    out["deliverable"] = deliverable;
  }
  const features = asArray5(spec["features"]);
  const modules = buildModulesMap(features);
  if (modules.length > 0) {
    out["modules"] = modules;
  }
  const metadata = asObject2(spec["metadata"]);
  if (metadata !== null) {
    for (const key of [
      "contribution_points",
      "host_binding",
      "command_map",
      "ambient_files"
    ]) {
      const val = metadata[key];
      if (val !== null && val !== void 0 && !(Array.isArray(val) && val.length === 0)) {
        out[key] = val;
      }
    }
  }
  const graph = buildFeatureGraph(features);
  if (graph.length > 0) {
    out["feature_graph"] = graph;
  }
  return (0, import_yaml8.stringify)(out, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0
  });
}
var import_yaml8;
var init_architecture = __esm({
  "src/render/architecture.ts"() {
    "use strict";
    import_yaml8 = __toESM(require_dist(), 1);
  }
});

// src/render/domain.ts
function getPath(d, path, defaultValue = null) {
  let cur = d;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return defaultValue;
    }
    cur = cur[part];
    if (cur === null || cur === void 0) {
      return defaultValue;
    }
  }
  return cur;
}
function multiline(text, prefix = "") {
  if (!text) {
    return "";
  }
  const lines = text.split("\n").map((line) => line ? prefix + line : "");
  return `${lines.join("\n")}
`;
}
function rstrip5(text) {
  return text.replace(/\s+$/, "");
}
function nowIso6() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function asArray6(value) {
  return Array.isArray(value) ? value : [];
}
function asString2(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asObject3(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
function render3(spec, options = {}) {
  const timestamp = options.timestamp ?? nowIso6();
  const projectName = asString2(getPath(spec, "project.name", "(unnamed)"), "(unnamed)");
  const projectSummary = asString2(getPath(spec, "project.summary", ""));
  const projectDescription = asString2(getPath(spec, "project.description", ""));
  const projectVision = asString2(getPath(spec, "project.vision", ""));
  const stakeholders = asArray6(getPath(spec, "project.stakeholders", []));
  const entities = asArray6(getPath(spec, "domain.entities", []));
  const businessRules = asArray6(getPath(spec, "domain.business_rules", []));
  const decisions = asArray6(getPath(spec, "decisions", []));
  const risks = asArray6(getPath(spec, "risks", []));
  const techStack = asObject3(getPath(spec, "constraints.tech_stack", {})) ?? {};
  const lines = [];
  lines.push(`# ${projectName} \u2014 Domain View`);
  lines.push("");
  lines.push(`> \uC790\uB3D9 \uC0DD\uC131 \u2014 ${timestamp}`);
  lines.push(">");
  lines.push("> \uC774 \uD30C\uC77C\uC740 `/harness:sync` \uAC00 `spec.yaml` \uC5D0\uC11C \uD30C\uC0DD. \uC9C1\uC811 \uD3B8\uC9D1 \uC2DC edit-wins \uBCF4\uD638.");
  lines.push("");
  lines.push("## Project");
  lines.push("");
  if (projectSummary) {
    lines.push(`**Summary**: ${projectSummary}`);
    lines.push("");
  }
  if (projectDescription) {
    lines.push("**Description**:");
    lines.push("");
    lines.push(rstrip5(multiline(projectDescription)));
    lines.push("");
  }
  if (projectVision) {
    lines.push("**Vision**:");
    lines.push("");
    lines.push(rstrip5(multiline(projectVision)));
    lines.push("");
  }
  if (Object.keys(techStack).length > 0) {
    lines.push("## Platform");
    lines.push("");
    const runtime = asString2(techStack["runtime"]);
    const minVersion = asString2(techStack["min_version"]);
    if (runtime) {
      let runtimeLine = `**Runtime**: ${runtime}`;
      if (minVersion) {
        runtimeLine += ` ${minVersion}+`;
      }
      lines.push(runtimeLine);
      lines.push("");
    }
    const language = asString2(techStack["language"]);
    if (language) {
      lines.push(`**Language**: ${language}`);
      lines.push("");
    }
    const test = asString2(techStack["test"]);
    if (test) {
      lines.push(`**Test**: ${test}`);
      lines.push("");
    }
    const build = asString2(techStack["build"]);
    if (build) {
      lines.push(`**Build**: ${build}`);
      lines.push("");
    }
    const known = /* @__PURE__ */ new Set(["runtime", "min_version", "language", "test", "build"]);
    const extras = Object.entries(techStack).filter(([k]) => !known.has(k));
    if (extras.length > 0) {
      lines.push("**Extra**:");
      for (const [k, v] of extras) {
        lines.push(`- ${k}: ${stringifyValue(v)}`);
      }
      lines.push("");
    }
  }
  lines.push(`## Stakeholders (${stakeholders.length})`);
  lines.push("");
  if (stakeholders.length === 0) {
    lines.push(
      "_(\uC815\uC758\uB41C stakeholder \uC5C6\uC74C \u2014 `spec.yaml` \uC758 `project.stakeholders[]` \uCC44\uC6B0\uAE30.)_"
    );
    lines.push("");
  } else {
    for (const sh of stakeholders) {
      const obj = asObject3(sh);
      if (obj === null) {
        continue;
      }
      const role = asString2(obj["role"]) || asString2(obj["id"]) || "(unnamed)";
      const count = obj["count"];
      let heading = `### ${role}`;
      if (count !== void 0 && count !== null && count !== "") {
        heading += ` (${stringifyValue(count)})`;
      }
      lines.push(heading);
      lines.push("");
      const desc = asString2(obj["description"]) || asString2(obj["interest"]);
      if (desc) {
        lines.push(rstrip5(multiline(desc)));
        lines.push("");
      }
      for (const [listKey, label] of [
        ["concerns", "Concerns"],
        ["wants", "Wants"],
        ["needs", "Needs"]
      ]) {
        const items = obj[listKey];
        if (Array.isArray(items) && items.length > 0) {
          lines.push(`**${label}**:`);
          for (const item of items) {
            const itemObj = asObject3(item);
            if (itemObj !== null) {
              const text = asString2(itemObj["text"]) || asString2(itemObj["statement"]) || String(item);
              lines.push(`- ${text}`);
            } else {
              lines.push(`- ${stringifyValue(item)}`);
            }
          }
          lines.push("");
        }
      }
    }
  }
  lines.push(`## Entities (${entities.length})`);
  lines.push("");
  if (entities.length === 0) {
    lines.push(
      "_(\uC815\uC758\uB41C \uC5D4\uD2F0\uD2F0 \uC5C6\uC74C \u2014 `spec.yaml` \uC758 `domain.entities[]` \uCC44\uC6B0\uAE30.)_"
    );
    lines.push("");
  } else {
    for (const ent of entities) {
      const obj = asObject3(ent);
      if (obj === null) {
        continue;
      }
      const entName = asString2(obj["name"]) || asString2(obj["id"]) || "(unnamed)";
      const entDesc = asString2(obj["description"]) || asString2(obj["summary"]);
      const invariants = asArray6(obj["invariants"]);
      const attrs = Array.isArray(obj["attributes"]) ? obj["attributes"] : asArray6(obj["fields"]);
      lines.push(`### ${entName}`);
      lines.push("");
      if (entDesc) {
        lines.push(rstrip5(multiline(entDesc)));
        lines.push("");
      }
      if (attrs.length > 0) {
        lines.push("**Attributes**:");
        for (const a of attrs) {
          const attrObj = asObject3(a);
          if (attrObj !== null) {
            const aName = asString2(attrObj["name"], "?");
            const aType = asString2(attrObj["type"], "?");
            lines.push(`- \`${aName}\`: ${aType}`);
          } else {
            lines.push(`- \`${stringifyValue(a)}\``);
          }
        }
        lines.push("");
      }
      if (invariants.length > 0) {
        lines.push("**Invariants**:");
        for (const inv of invariants) {
          const invObj = asObject3(inv);
          if (invObj !== null) {
            lines.push(`- ${asString2(invObj["statement"], stringifyValue(inv))}`);
          } else {
            lines.push(`- ${stringifyValue(inv)}`);
          }
        }
        lines.push("");
      }
    }
  }
  lines.push(`## Business Rules (${businessRules.length})`);
  lines.push("");
  if (businessRules.length === 0) {
    lines.push(
      "_(\uC815\uC758\uB41C BR \uC5C6\uC74C \u2014 `spec.yaml` \uC758 `domain.business_rules[]` \uCC44\uC6B0\uAE30.)_"
    );
    lines.push("");
  } else {
    businessRules.forEach((br, idx) => {
      const i = idx + 1;
      const padded = `BR-${String(i).padStart(3, "0")}`;
      const obj = asObject3(br);
      if (obj !== null) {
        const brId = asString2(obj["id"], padded);
        const statement = asString2(obj["statement"]) || asString2(obj["name"]);
        const rationale = asString2(obj["rationale"]);
        lines.push(`### ${brId}`);
        lines.push("");
        if (statement) {
          lines.push(`**Statement**: ${statement}`);
          lines.push("");
        }
        if (rationale) {
          lines.push(`**Rationale**: ${rationale}`);
          lines.push("");
        }
      } else {
        lines.push(`- ${padded}: ${stringifyValue(br)}`);
        lines.push("");
      }
    });
  }
  lines.push(`## Decisions (${decisions.length})`);
  lines.push("");
  if (decisions.length === 0) {
    lines.push(
      "_(\uC815\uC758\uB41C ADR \uC5C6\uC74C \u2014 `spec.yaml` \uC758 `decisions[]` \uB610\uB294 plan.md \uB97C \uACBD\uC720\uD574 \uCC44\uC6B0\uAE30.)_"
    );
    lines.push("");
  } else {
    for (const d of decisions) {
      const obj = asObject3(d);
      if (obj === null) {
        continue;
      }
      const adrId = asString2(obj["id"], "ADR-???");
      const title = asString2(obj["title"], "(untitled)");
      const status = asString2(obj["status"], "accepted");
      const tags = asArray6(obj["tags"]);
      const tagStr = tags.length > 0 ? ` \xB7 tags: ${tags.map(String).join(", ")}` : "";
      lines.push(`### ${adrId} \u2014 ${title}`);
      lines.push("");
      lines.push(`**Status**: ${status}${tagStr}`);
      lines.push("");
      const context = asString2(obj["context"]);
      const decision = asString2(obj["decision"]);
      const consequences = asString2(obj["consequences"]);
      if (context) {
        lines.push("**Context**:");
        lines.push("");
        lines.push(rstrip5(multiline(context)));
        lines.push("");
      }
      if (decision) {
        lines.push("**Decision**:");
        lines.push("");
        lines.push(rstrip5(multiline(decision)));
        lines.push("");
      }
      if (consequences) {
        lines.push("**Consequences**:");
        lines.push("");
        lines.push(rstrip5(multiline(consequences)));
        lines.push("");
      }
      const supersedes = asArray6(obj["supersedes"]);
      const supersededBy = asString2(obj["superseded_by"]);
      if (supersedes.length > 0) {
        lines.push(`**Supersedes**: ${supersedes.map(String).join(", ")}`);
        lines.push("");
      }
      if (supersededBy) {
        lines.push(`**Superseded by**: ${supersededBy}`);
        lines.push("");
      }
    }
  }
  lines.push(`## Risks (${risks.length})`);
  lines.push("");
  if (risks.length === 0) {
    lines.push(
      "_(\uC815\uC758\uB41C risk \uC5C6\uC74C \u2014 `spec.yaml` \uC758 `risks[]` \uB610\uB294 plan.md \uB97C \uACBD\uC720\uD574 \uCC44\uC6B0\uAE30.)_"
    );
    lines.push("");
  } else {
    for (const r of risks) {
      const obj = asObject3(r);
      if (obj === null) {
        continue;
      }
      const riskId = asString2(obj["id"], "R-???");
      const statement = asString2(obj["statement"]);
      const likelihood = asString2(obj["likelihood"], "?");
      const impact = asString2(obj["impact"], "?");
      const mitigation = asString2(obj["mitigation"]);
      const status = asString2(obj["status"], "open");
      const tags = asArray6(obj["tags"]);
      const tagStr = tags.length > 0 ? ` \xB7 tags: ${tags.map(String).join(", ")}` : "";
      lines.push(`### ${riskId}`);
      lines.push("");
      if (statement) {
        lines.push(`**Statement**: ${statement}`);
        lines.push("");
      }
      lines.push(
        `**Likelihood \xD7 Impact**: ${likelihood} \xD7 ${impact} \xB7 status: ${status}${tagStr}`
      );
      lines.push("");
      if (mitigation) {
        lines.push(`**Mitigation**: ${mitigation}`);
        lines.push("");
      }
    }
  }
  return `${rstrip5(lines.join("\n"))}
`;
}
function stringifyValue(value) {
  if (value === null) {
    return "None";
  }
  if (value === void 0) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
var import_yaml9;
var init_domain = __esm({
  "src/render/domain.ts"() {
    "use strict";
    import_yaml9 = __toESM(require_dist(), 1);
  }
});

// src/sync.ts
import { createHash as createHash3 } from "node:crypto";
import { appendFileSync as appendFileSync5, mkdirSync as mkdirSync5, readFileSync as readFileSync12, statSync as statSync13, writeFileSync as writeFileSync6 } from "node:fs";
import { dirname as dirname7, join as join13, resolve as resolvePath5 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function nowIso7() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function isFile5(path) {
  try {
    return statSync13(path).isFile();
  } catch {
    return false;
  }
}
function isPlainObject11(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fileSha2562(path) {
  return createHash3("sha256").update(readFileSync12(path)).digest("hex");
}
function stringSha256(text) {
  return createHash3("sha256").update(text, "utf-8").digest("hex");
}
function loadYamlFile2(path) {
  if (!isFile5(path)) {
    return {};
  }
  const parsed = (0, import_yaml10.parse)(readFileSync12(path, "utf-8"));
  return isPlainObject11(parsed) ? parsed : {};
}
function dumpYamlFile(path, data) {
  mkdirSync5(dirname7(path), { recursive: true });
  const out = (0, import_yaml10.stringify)(data, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0
  });
  writeFileSync6(path, out, "utf-8");
}
function appendEvent4(eventsLog, event) {
  mkdirSync5(dirname7(eventsLog), { recursive: true });
  appendFileSync5(eventsLog, `${pythonStyleJsonStringify4(event)}
`, "utf-8");
}
function pythonStyleJsonStringify4(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `sync: non-finite number cannot be serialized (${String(value)}).`
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify4(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify4(v)}`
    );
    return `{${pairs.join(", ")}}`;
  }
  throw new TypeError(`sync: unsupported value type ${typeof value}.`);
}
function editWins(outputPath, previousOutputHash) {
  if (!isFile5(outputPath)) {
    return false;
  }
  if (!previousOutputHash) {
    return false;
  }
  return fileSha2562(outputPath) !== previousOutputHash;
}
function scriptRepoVersion() {
  const repo = resolvePath5(__dirname2, "..");
  const manifest = join13(repo, ".claude-plugin", "plugin.json");
  if (!isFile5(manifest)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync12(manifest, "utf-8"));
    if (isPlainObject11(parsed) && typeof parsed["version"] === "string") {
      return parsed["version"];
    }
  } catch {
    return null;
  }
  return null;
}
function pluginVersion(harnessDir) {
  const v = scriptRepoVersion();
  if (v) {
    return v;
  }
  const candidates = [resolvePath5(harnessDir, ".."), process.cwd()];
  let cur = process.cwd();
  while (true) {
    const next = resolvePath5(cur, "..");
    if (next === cur) {
      break;
    }
    candidates.push(next);
    cur = next;
  }
  for (const parent of candidates) {
    const manifest = join13(parent, ".claude-plugin", "plugin.json");
    if (!isFile5(manifest)) {
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync12(manifest, "utf-8"));
      if (isPlainObject11(parsed) && typeof parsed["version"] === "string") {
        return parsed["version"];
      }
    } catch {
      continue;
    }
  }
  try {
    const root = resolve().root;
    const manifest = join13(root, ".claude-plugin", "plugin.json");
    if (isFile5(manifest)) {
      const parsed = JSON.parse(readFileSync12(manifest, "utf-8"));
      if (isPlainObject11(parsed) && typeof parsed["version"] === "string") {
        return parsed["version"];
      }
    }
  } catch (err) {
    if (!(err instanceof PluginRootError) && !err.code) {
      throw err;
    }
  }
  return "unknown";
}
function defaultHarnessYaml() {
  return {
    version: "2.3",
    hash_protocol_version: "1",
    generation: {
      generated_from: { spec_hash: "", subtrees: {} },
      derived_from: {
        domain_md: { source_hash: "", output_hash: "", user_edit_detected: false },
        architecture_yaml: {
          source_hash: "",
          output_hash: "",
          user_edit_detected: false
        }
      },
      include_sources: [],
      drift_status: "clean"
    },
    policies: { prose_polish: false }
  };
}
function run(harnessDir, options = {}) {
  const ts = options.timestamp ?? nowIso7();
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const skipValidation = options.skipValidation ?? false;
  const specPath = join13(harnessDir, "spec.yaml");
  const harnessYamlPath = join13(harnessDir, "harness.yaml");
  const domainPath = join13(harnessDir, "domain.md");
  const archPath = join13(harnessDir, "architecture.yaml");
  const eventsLog = join13(harnessDir, "events.log");
  const chaptersDir = join13(harnessDir, "chapters");
  if (!isFile5(specPath)) {
    throw new Error(`${specPath} \uAC00 \uC5C6\uC74C \u2014 \uBA3C\uC800 /harness:init \uB610\uB294 \uC218\uB3D9 \uC0DD\uC131 \uD544\uC694`);
  }
  let harnessYaml;
  if (isFile5(harnessYamlPath)) {
    harnessYaml = loadYamlFile2(harnessYamlPath);
    if (!isPlainObject11(harnessYaml.generation)) {
      harnessYaml.generation = defaultHarnessYaml().generation;
    }
  } else {
    harnessYaml = defaultHarnessYaml();
  }
  const rawSpec = loadYamlFile2(specPath);
  if (!skipValidation) {
    try {
      validate(rawSpec, options.schemaPath ?? null);
    } catch (err) {
      if (err instanceof SpecValidationError && !dryRun) {
        appendEvent4(eventsLog, {
          ts,
          type: "sync_failed",
          reason: "schema_validation",
          path: err.path.length > 0 ? err.path.map(String).join(".") : "(root)",
          message: err.message,
          validator: err.reason
        });
      }
      throw err;
    }
  }
  const includesFound = findIncludes(rawSpec);
  const expandedSpec = includesFound.length > 0 ? expand(rawSpec, chaptersDir) : rawSpec;
  const hashRaw = canonicalHash(rawSpec);
  const hashExpanded = includesFound.length > 0 ? canonicalHash(expandedSpec) : hashRaw;
  const subtrees = subtreeHashes(expandedSpec);
  const merkle = merkleRoot(subtrees);
  const generation = harnessYaml.generation ?? defaultHarnessYaml().generation;
  harnessYaml.generation = generation;
  const derived = generation.derived_from;
  const dEntry = derived.domain_md;
  const aEntry = derived.architecture_yaml;
  let domainSkipped = false;
  let archSkipped = false;
  if (editWins(domainPath, dEntry.output_hash) && !force) {
    domainSkipped = true;
    dEntry.user_edit_detected = true;
  } else {
    const rendered = render3(expandedSpec, { timestamp: ts });
    if (!dryRun) {
      mkdirSync5(dirname7(domainPath), { recursive: true });
      writeFileSync6(domainPath, rendered, "utf-8");
    }
    dEntry.source_hash = hashExpanded;
    dEntry.output_hash = stringSha256(rendered);
    dEntry.user_edit_detected = false;
  }
  if (editWins(archPath, aEntry.output_hash) && !force) {
    archSkipped = true;
    aEntry.user_edit_detected = true;
  } else {
    const rendered = render2(expandedSpec, {
      timestamp: ts,
      sourceRef: "spec.yaml"
    });
    if (!dryRun) {
      writeFileSync6(archPath, rendered, "utf-8");
    }
    aEntry.source_hash = hashExpanded;
    aEntry.output_hash = stringSha256(rendered);
    aEntry.user_edit_detected = false;
  }
  generation.generated_from = {
    spec_hash: hashRaw,
    spec_hash_expanded: includesFound.length > 0 ? hashExpanded : null,
    merkle_root: merkle,
    subtrees
  };
  generation.include_sources = includesFound.map((item) => item.target);
  const drift = [];
  if (domainSkipped) {
    drift.push("domain.md");
  }
  if (archSkipped) {
    drift.push("architecture.yaml");
  }
  generation.drift_status = drift.length > 0 ? "derived_edited" : "clean";
  if (!dryRun) {
    dumpYamlFile(harnessYamlPath, harnessYaml);
  }
  const event = {
    ts,
    type: "sync_completed",
    plugin_version: pluginVersion(harnessDir),
    phase: "0",
    spec_hash: hashRaw,
    merkle_root: merkle,
    derived: [
      ...!domainSkipped ? ["domain.md"] : [],
      ...!archSkipped ? ["architecture.yaml"] : []
    ],
    skipped: drift,
    dry_run: dryRun
  };
  if (!dryRun) {
    appendEvent4(eventsLog, event);
  }
  return {
    ok: true,
    spec_hash: hashRaw,
    merkle_root: merkle,
    include_count: includesFound.length,
    domain_skipped: domainSkipped,
    arch_skipped: archSkipped,
    dry_run: dryRun,
    drift_status: generation.drift_status
  };
}
function tryInitialSync(harnessDir) {
  const specPath = join13(harnessDir, "spec.yaml");
  if (!isFile5(specPath)) {
    return { ok: false, reason: "spec.yaml missing", skipped: true };
  }
  try {
    const harnessYamlPath = join13(harnessDir, "harness.yaml");
    if (isFile5(harnessYamlPath)) {
      const cfg = loadYamlFile2(harnessYamlPath);
      const gen = isPlainObject11(cfg["generation"]) ? cfg["generation"] : {};
      const generated = isPlainObject11(gen["generated_from"]) ? gen["generated_from"] : {};
      const specHash = generated["spec_hash"];
      if (typeof specHash === "string" && specHash.length > 0) {
        return { ok: true, reason: "already synced", skipped: true };
      }
    }
    run(harnessDir);
    return { ok: true, reason: "synced" };
  } catch (err) {
    const cls = err.constructor?.name ?? "Error";
    const msg = err.message ?? String(err);
    return { ok: false, reason: `${cls}: ${msg}` };
  }
}
var import_yaml10, __filename2, __dirname2;
var init_sync = __esm({
  "src/sync.ts"() {
    "use strict";
    import_yaml10 = __toESM(require_dist(), 1);
    init_canonicalHash();
    init_pluginRoot();
    init_includeExpander();
    init_validate();
    init_architecture();
    init_domain();
    __filename2 = fileURLToPath2(import.meta.url);
    __dirname2 = dirname7(__filename2);
  }
});

// src/gate/runner.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync3, readFileSync as readFileSync13, readdirSync as readdirSync4, statSync as statSync14 } from "node:fs";
import { delimiter as pathDelimiter2, join as join14, sep as pathSep } from "node:path";
function which(bin) {
  const pathEnv = process.env["PATH"] ?? "";
  for (const entry of pathEnv.split(pathDelimiter2)) {
    if (entry.length === 0) {
      continue;
    }
    const candidate = join14(entry, bin);
    try {
      const stat = statSync14(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}
function isFile6(path) {
  try {
    return statSync14(path).isFile();
  } catch {
    return false;
  }
}
function isDirectory3(path) {
  try {
    return statSync14(path).isDirectory();
  } catch {
    return false;
  }
}
function tail(text, nLines = 30) {
  if (!text) {
    return "";
  }
  const lines = text.split("\n");
  if (lines.length <= nLines) {
    return lines.join("\n");
  }
  return ["... (earlier output elided)", ...lines.slice(-nLines)].join("\n");
}
function pytestCommand() {
  if (which("pytest") !== null) {
    return ["pytest"];
  }
  for (const py of ["python3", "python"]) {
    if (which(py) === null) {
      continue;
    }
    try {
      const probe = spawnSync(py, ["-m", "pytest", "--version"], {
        encoding: "utf-8",
        timeout: 5e3
      });
      if (probe.status === 0) {
        return [py, "-m", "pytest"];
      }
    } catch {
      continue;
    }
  }
  return null;
}
function npmScriptCommand(projectRoot, scriptName) {
  const pkg = join14(projectRoot, "package.json");
  if (!isFile6(pkg)) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync13(pkg, "utf-8"));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const scripts = parsed["scripts"];
  if (scripts === null || typeof scripts !== "object" || Array.isArray(scripts) || !(scriptName in scripts)) {
    return null;
  }
  if (which("npm") === null) {
    return null;
  }
  if (scriptName === "test") {
    return ["npm", "test"];
  }
  return ["npm", "run", scriptName];
}
function detectGate0Command(projectRoot) {
  const pyproject = join14(projectRoot, "pyproject.toml");
  if (isFile6(pyproject)) {
    try {
      const text = readFileSync13(pyproject, "utf-8");
      if (text.includes("[tool.pytest")) {
        const cmd = pytestCommand();
        if (cmd !== null) {
          return cmd;
        }
      }
    } catch {
    }
  }
  const npmTest = npmScriptCommand(projectRoot, "test");
  if (npmTest !== null) {
    return npmTest;
  }
  const testsDir = join14(projectRoot, "tests");
  if (isDirectory3(testsDir)) {
    const cmd = pytestCommand();
    if (cmd !== null) {
      return cmd;
    }
    const py = which("python3") !== null ? "python3" : which("python") !== null ? "python" : null;
    if (py === null) {
      return null;
    }
    const preferred = join14(testsDir, "unit");
    if (isDirectory3(preferred) && hasTestFiles(preferred)) {
      return [py, "-m", "unittest", "discover", "tests.unit"];
    }
    let entries;
    try {
      entries = readdirSync4(testsDir).sort();
    } catch {
      entries = [];
    }
    for (const sub of entries) {
      const subPath = join14(testsDir, sub);
      if (isDirectory3(subPath) && hasTestFiles(subPath)) {
        return [py, "-m", "unittest", "discover", `tests.${sub}`];
      }
    }
    return [py, "-m", "unittest", "discover", "-s", "tests"];
  }
  const makefile = join14(projectRoot, "Makefile");
  if (isFile6(makefile)) {
    try {
      for (const line of readFileSync13(makefile, "utf-8").split("\n")) {
        if (line.trim().startsWith("test:")) {
          if (which("make") !== null) {
            return ["make", "test"];
          }
          break;
        }
      }
    } catch {
    }
  }
  return null;
}
function hasTestFiles(dir) {
  try {
    return readdirSync4(dir).some(
      (name) => name.startsWith("test_") && name.endsWith(".py") && isFile6(join14(dir, name))
    );
  } catch {
    return false;
  }
}
function detectGate1Command(projectRoot) {
  const pyproject = join14(projectRoot, "pyproject.toml");
  if (isFile6(pyproject)) {
    if (which("mypy") !== null) {
      return ["mypy", "--no-incremental", "."];
    }
    if (which("pyright") !== null) {
      return ["pyright"];
    }
  }
  const npmCmd = npmScriptCommand(projectRoot, "typecheck");
  if (npmCmd !== null) {
    return npmCmd;
  }
  const tsconfig = join14(projectRoot, "tsconfig.json");
  if (isFile6(tsconfig)) {
    if (which("tsc") !== null) {
      return ["tsc", "--noEmit"];
    }
    if (which("npx") !== null) {
      return ["npx", "tsc", "--noEmit"];
    }
  }
  if (isFile6(join14(projectRoot, "Cargo.toml"))) {
    if (which("cargo") !== null) {
      return ["cargo", "check"];
    }
  }
  if (isFile6(join14(projectRoot, "go.mod"))) {
    if (which("go") !== null) {
      return ["go", "vet", "./..."];
    }
  }
  return null;
}
function detectGate2Command(projectRoot) {
  const pyproject = join14(projectRoot, "pyproject.toml");
  if (isFile6(pyproject)) {
    if (which("ruff") !== null) {
      return ["ruff", "check", "."];
    }
    if (which("flake8") !== null) {
      return ["flake8"];
    }
  }
  const npmCmd = npmScriptCommand(projectRoot, "lint");
  if (npmCmd !== null) {
    return npmCmd;
  }
  if (isFile6(join14(projectRoot, "package.json"))) {
    if (which("eslint") !== null) {
      return ["eslint", "."];
    }
    if (which("npx") !== null) {
      return ["npx", "eslint", "."];
    }
  }
  const eslintCandidates = [
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.js",
    "eslint.config.js",
    "eslint.config.mjs"
  ];
  if (eslintCandidates.some((c) => isFile6(join14(projectRoot, c)))) {
    if (which("eslint") !== null) {
      return ["eslint", "."];
    }
    if (which("npx") !== null) {
      return ["npx", "eslint", "."];
    }
  }
  if (isFile6(join14(projectRoot, "Cargo.toml"))) {
    if (which("cargo") !== null) {
      return ["cargo", "clippy", "--all-targets", "--", "-D", "warnings"];
    }
  }
  if (isFile6(join14(projectRoot, "go.mod"))) {
    if (which("golangci-lint") !== null) {
      return ["golangci-lint", "run"];
    }
  }
  return null;
}
function detectGate3Command(projectRoot) {
  const pyproject = join14(projectRoot, "pyproject.toml");
  if (isFile6(pyproject)) {
    const cmd = pytestCommand();
    if (cmd !== null) {
      try {
        const text = readFileSync13(pyproject, "utf-8");
        if (text.includes("pytest-cov") || text.includes("[tool.coverage")) {
          return [...cmd, "--cov"];
        }
      } catch {
      }
    }
    if (which("coverage") !== null && cmd !== null) {
      return ["sh", "-c", "coverage run -m pytest && coverage report"];
    }
  }
  for (const name of ["test:coverage", "coverage"]) {
    const npmCmd = npmScriptCommand(projectRoot, name);
    if (npmCmd !== null) {
      return npmCmd;
    }
  }
  if (isFile6(join14(projectRoot, "package.json"))) {
    if (which("npx") !== null) {
      return ["npx", "nyc", "npm", "test"];
    }
  }
  if (isFile6(join14(projectRoot, "Cargo.toml"))) {
    if (which("cargo-tarpaulin") !== null) {
      return ["cargo", "tarpaulin"];
    }
    if (which("cargo-llvm-cov") !== null) {
      return ["cargo", "llvm-cov"];
    }
  }
  if (isFile6(join14(projectRoot, "go.mod"))) {
    if (which("go") !== null) {
      return ["go", "test", "-cover", "./..."];
    }
  }
  return null;
}
function detectGate4Command(projectRoot) {
  if (!existsSync3(join14(projectRoot, ".git"))) {
    return null;
  }
  if (which("git") === null) {
    return null;
  }
  return ["sh", "-c", "git diff --quiet && git diff --cached --quiet"];
}
function playwrightCommand(projectRoot) {
  for (const name of PW_CONFIG_NAMES) {
    if (isFile6(join14(projectRoot, name))) {
      return ["npx", "playwright", "test"];
    }
  }
  return null;
}
function cypressCommand(projectRoot) {
  for (const name of CY_CONFIG_NAMES) {
    if (isFile6(join14(projectRoot, name))) {
      return ["npx", "cypress", "run"];
    }
  }
  return null;
}
function detectGate5Command(projectRoot) {
  const smokeSh = join14(projectRoot, "scripts", "smoke.sh");
  if (isFile6(smokeSh)) {
    return ["sh", smokeSh];
  }
  const pw = playwrightCommand(projectRoot);
  if (pw !== null) {
    return pw;
  }
  const cy = cypressCommand(projectRoot);
  if (cy !== null) {
    return cy;
  }
  for (const name of ["smoke", "test:e2e"]) {
    const npmCmd = npmScriptCommand(projectRoot, name);
    if (npmCmd !== null) {
      return npmCmd;
    }
  }
  const smokeDir = join14(projectRoot, "tests", "smoke");
  if (isDirectory3(smokeDir)) {
    if (which("pytest") !== null) {
      return ["pytest", `tests${pathSep}smoke`];
    }
    const py = which("python3") !== null ? "python3" : which("python") !== null ? "python" : null;
    if (py !== null) {
      return [py, "-m", "unittest", "discover", "-s", `tests${pathSep}smoke`];
    }
  }
  const makefile = join14(projectRoot, "Makefile");
  if (isFile6(makefile)) {
    try {
      for (const line of readFileSync13(makefile, "utf-8").split("\n")) {
        if (line.trim().startsWith("smoke:")) {
          if (which("make") !== null) {
            return ["make", "smoke"];
          }
          break;
        }
      }
    } catch {
    }
  }
  return null;
}
function detectGatePerfCommand(_projectRoot) {
  return null;
}
function harnessYamlOverride(harnessDir, gate) {
  if (harnessDir === null) {
    return null;
  }
  const path = join14(harnessDir, "harness.yaml");
  if (!isFile6(path)) {
    return null;
  }
  let data;
  try {
    data = (0, import_yaml11.parse)(readFileSync13(path, "utf-8"));
  } catch {
    return null;
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const cmds = data["gate_commands"];
  if (cmds === null || typeof cmds !== "object" || Array.isArray(cmds)) {
    return null;
  }
  const val = cmds[gate];
  if (Array.isArray(val) && val.every((x) => typeof x === "string")) {
    return val;
  }
  if (typeof val === "string" && val.trim().length > 0) {
    return val.split(/\s+/).filter((x) => x.length > 0);
  }
  return null;
}
function resolveCommand(gate, projectRoot, override, harnessDir, detect) {
  if (override !== null) {
    return [...override];
  }
  const yamlCmd = harnessYamlOverride(harnessDir, gate);
  if (yamlCmd !== null) {
    return yamlCmd;
  }
  return detect(projectRoot);
}
function execute(gate, cmd, projectRoot, timeoutSec) {
  const start = process.hrtime.bigint();
  let proc;
  try {
    proc = spawnSync(cmd[0], cmd.slice(1), {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: timeoutSec * 1e3
    });
  } catch (err) {
    return {
      gate,
      result: "skipped",
      reason: `command not found: ${cmd[0]}`,
      command: cmd,
      exitCode: null,
      stdoutTail: "",
      stderrTail: err.message ?? "",
      durationSec: 0
    };
  }
  const elapsed = Number((process.hrtime.bigint() - start) / 1000000n) / 1e3;
  const stdout = typeof proc.stdout === "string" ? proc.stdout : "";
  const stderr = typeof proc.stderr === "string" ? proc.stderr : "";
  if (proc.error !== void 0 && proc.error !== null) {
    const errAny = proc.error;
    if (errAny.code === "ENOENT") {
      return {
        gate,
        result: "skipped",
        reason: `command not found: ${cmd[0]}`,
        command: cmd,
        exitCode: null,
        stdoutTail: "",
        stderrTail: "",
        durationSec: 0
      };
    }
    if (errAny.signal === "SIGTERM" || proc.signal === "SIGTERM") {
      return {
        gate,
        result: "fail",
        reason: `timeout after ${timeoutSec}s`,
        command: cmd,
        exitCode: null,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
        durationSec: timeoutSec
      };
    }
  }
  if (proc.signal === "SIGTERM") {
    return {
      gate,
      result: "fail",
      reason: `timeout after ${timeoutSec}s`,
      command: cmd,
      exitCode: null,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr),
      durationSec: timeoutSec
    };
  }
  const status = proc.status ?? -1;
  const result = status === 0 ? "pass" : "fail";
  return {
    gate,
    result,
    reason: result === "pass" ? "" : `exit ${status}`,
    command: cmd,
    exitCode: status,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    durationSec: elapsed
  };
}
function skippedResult(gate, reason) {
  return {
    gate,
    result: "skipped",
    reason,
    command: [],
    exitCode: null,
    stdoutTail: "",
    stderrTail: "",
    durationSec: 0
  };
}
function runGate0(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_0",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate0Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_0",
      "no test command detected (pyproject.toml \xB7 tests/ \xB7 package.json \xB7 Makefile \uBAA8\uB450 \uBD80\uC7AC)"
    );
  }
  return execute("gate_0", cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}
function runGate1(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_1",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate1Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_1",
      "no type checker detected (pyproject.toml \xB7 tsconfig.json \xB7 Cargo.toml \xB7 go.mod \uBAA8\uB450 \uBD80\uC7AC \uB610\uB294 tool \uBBF8\uC124\uCE58)"
    );
  }
  return execute("gate_1", cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}
function runGate2(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_2",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate2Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_2",
      "no linter detected (pyproject/ruff \xB7 package.json/eslint \xB7 Cargo/clippy \xB7 go.mod/golangci-lint \uBAA8\uB450 \uBD80\uC7AC)"
    );
  }
  return execute("gate_2", cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}
function runGate3(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_3",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate3Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_3",
      "no coverage tool detected (pytest-cov \xB7 nyc \xB7 scripts.coverage \xB7 tarpaulin \xB7 go -cover \uBAA8\uB450 \uBD80\uC7AC)"
    );
  }
  return execute("gate_3", cmd, projectRoot, options.timeoutSec ?? 600);
}
function runGate4(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_4",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate4Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_4",
      "not a git repo or git binary \uBD80\uC7AC \u2014 commit gate \uAC80\uC99D \uBD88\uAC00"
    );
  }
  return execute("gate_4", cmd, projectRoot, options.timeoutSec ?? 30);
}
function runGate5(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_5",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate5Command
  );
  if (cmd === null) {
    return skippedResult(
      "gate_5",
      "no runtime smoke detected (scripts/smoke.sh \xB7 tests/smoke/ \xB7 Makefile smoke \xB7 package.json scripts.smoke \uBAA8\uB450 \uBD80\uC7AC) \u2014 harness.yaml.gate_commands.gate_5 \uB85C \uC124\uC815 \uD544\uC694"
    );
  }
  return execute("gate_5", cmd, projectRoot, options.timeoutSec ?? 600);
}
function runGatePerf(projectRoot, options = {}) {
  const cmd = resolveCommand(
    "gate_perf",
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGatePerfCommand
  );
  if (cmd === null) {
    return skippedResult(
      "gate_perf",
      "no perf runner configured \u2014 harness.yaml.gate_commands.gate_perf \uB610\uB294 --override-command \uD544\uC694"
    );
  }
  return execute("gate_perf", cmd, projectRoot, options.timeoutSec ?? 900);
}
function runGate(gate, projectRoot, options = {}) {
  switch (gate) {
    case "gate_0":
      return runGate0(projectRoot, options);
    case "gate_1":
      return runGate1(projectRoot, options);
    case "gate_2":
      return runGate2(projectRoot, options);
    case "gate_3":
      return runGate3(projectRoot, options);
    case "gate_4":
      return runGate4(projectRoot, options);
    case "gate_5":
      return runGate5(projectRoot, options);
    case "gate_perf":
      return runGatePerf(projectRoot, options);
    default:
      return skippedResult(
        gate,
        `${gate} auto-run not yet supported (v0.3.7 shipped gate_0~gate_5)`
      );
  }
}
var import_yaml11, DEFAULT_TIMEOUT_SEC, PW_CONFIG_NAMES, CY_CONFIG_NAMES;
var init_runner = __esm({
  "src/gate/runner.ts"() {
    "use strict";
    import_yaml11 = __toESM(require_dist(), 1);
    DEFAULT_TIMEOUT_SEC = 300;
    PW_CONFIG_NAMES = [
      "playwright.config.ts",
      "playwright.config.js",
      "playwright.config.mjs",
      "playwright.config.cjs"
    ];
    CY_CONFIG_NAMES = [
      "cypress.config.ts",
      "cypress.config.js",
      "cypress.config.mjs",
      "cypress.config.cjs"
    ];
  }
});

// src/work.ts
import { appendFileSync as appendFileSync6, mkdirSync as mkdirSync6, readFileSync as readFileSync14, statSync as statSync15 } from "node:fs";
import { dirname as dirname8, join as join15, resolve as resolvePath6 } from "node:path";
import { spawnSync as spawnSync2 } from "node:child_process";
function friendlyGate(gateName) {
  const label = GATE_FRIENDLY[gateName];
  return label ? `${label} (${gateName})` : gateName;
}
function isPlainObject12(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isFile7(path) {
  try {
    return statSync15(path).isFile();
  } catch {
    return false;
  }
}
function nowIso8() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function pythonStyleJsonStringify5(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`work: non-finite number cannot be serialized (${String(value)}).`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify5(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify5(v)}`
    );
    return `{${pairs.join(", ")}}`;
  }
  throw new TypeError(`work: unsupported value type ${typeof value}.`);
}
function appendEvent5(harnessDir, event) {
  const logPath = join15(harnessDir, "events.log");
  mkdirSync6(dirname8(logPath), { recursive: true });
  appendFileSync6(logPath, `${pythonStyleJsonStringify5(event)}
`, "utf-8");
}
function loadSpec2(harnessDir) {
  const path = join15(harnessDir, "spec.yaml");
  if (!isFile7(path)) {
    return null;
  }
  try {
    const parsed = (0, import_yaml12.parse)(readFileSync14(path, "utf-8"));
    return isPlainObject12(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function findFeature(spec, fid) {
  const features = spec["features"];
  if (!Array.isArray(features)) {
    return null;
  }
  for (const f of features) {
    if (isPlainObject12(f) && f["id"] === fid) {
      return f;
    }
  }
  return null;
}
function summarize(state, fid) {
  const f = state.getFeature(fid);
  const gates = f?.gates ?? {};
  const passed = [];
  const failed = [];
  for (const [g, v] of Object.entries(gates)) {
    if (isPlainObject12(v) && v["last_result"] === "pass") {
      passed.push(g);
    } else if (isPlainObject12(v) && v["last_result"] === "fail") {
      failed.push(g);
    }
  }
  return {
    feature_id: fid,
    action: "queried",
    current_status: f?.status ?? "planned",
    gates_passed: passed,
    gates_failed: failed,
    evidence_count: Array.isArray(f?.evidence) ? f.evidence.length : 0,
    message: "",
    routed_agents: [],
    parallel_groups: []
  };
}
function autowireInitialSync(harnessDir) {
  try {
    const result = tryInitialSync(harnessDir);
    if (!result.ok && result.reason !== "spec.yaml missing") {
      process.stderr.write(
        `[warn] initial sync auto-wire failed: ${result.reason} \u2014 run \`npm run sync -- --harness-dir ${harnessDir}\` manually
`
      );
    }
  } catch (err) {
    process.stderr.write(
      `[warn] initial sync auto-wire failed: ${err.message}
`
    );
  }
}
function autowireKickoff(harnessDir, fid, force = false) {
  const spec = loadSpec2(harnessDir);
  if (spec === null) {
    return;
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return;
  }
  try {
    const shapes = detectShapes(feature, spec);
    if (shapes.length === 0) {
      return;
    }
    let styleBlock = "";
    try {
      styleBlock = renderStyleBlock(harnessDir, feature);
    } catch {
      styleBlock = "";
    }
    generateKickoff(harnessDir, fid, shapes, {
      hasAudio: hasAudioFlag(feature),
      force,
      mode: resolveMode(spec),
      styleBlock
    });
  } catch {
  }
}
function autowireRetro(harnessDir, fid, force = false) {
  const spec = loadSpec2(harnessDir);
  if (spec === null) {
    return;
  }
  try {
    generateRetro(harnessDir, fid, {
      force,
      mode: resolveMode(spec)
    });
  } catch {
  }
}
function autowireDesignReview(harnessDir, fid, force = false) {
  const spec = loadSpec2(harnessDir);
  if (spec === null) {
    return;
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return;
  }
  const ui = isPlainObject12(feature["ui_surface"]) ? feature["ui_surface"] : {};
  if (ui["present"] !== true) {
    return;
  }
  const flowsPath = join15(harnessDir, "_workspace", "design", "flows.md");
  if (!isFile7(flowsPath)) {
    return;
  }
  const reviewPath = join15(harnessDir, "_workspace", "design-review", `${fid}.md`);
  if (isFile7(reviewPath) && !force) {
    return;
  }
  if (resolveMode(spec) === "prototype" && !force) {
    return;
  }
  try {
    generateDesignReview(harnessDir, fid, { hasAudio: hasAudioFlag(feature) });
  } catch {
  }
}
function resolveRouting(harnessDir, fid) {
  const spec = loadSpec2(harnessDir);
  if (spec === null) {
    return { agents: [], groups: [] };
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return { agents: [], groups: [] };
  }
  try {
    const shapes = detectShapes(feature, spec);
    if (shapes.length === 0) {
      return { agents: [], groups: [] };
    }
    const audio = hasAudioFlag(feature);
    return {
      agents: agentsForShapes(shapes, audio),
      groups: parallelGroupsForShapes(shapes, audio)
    };
  } catch {
    return { agents: [], groups: [] };
  }
}
function warnIfGhost(harnessDir, fid) {
  const spec = loadSpec2(harnessDir);
  if (spec === null) {
    return;
  }
  if (findFeature(spec, fid) === null) {
    process.stderr.write(
      `warn: ${fid} not defined in spec.yaml \u2014 proceeding as ghost feature. Use /harness:spec to register it or \`--remove ${fid}\` to undo.
`
    );
  }
}
function warnIfConcurrent(state, fid) {
  const others = state.featuresInProgress().filter((f) => f !== fid);
  if (others.length > 0) {
    process.stderr.write(
      `warn: other feature(s) still in_progress: ${others.join(", ")}. Finish or block before switching, or ignore to work in parallel.
`
    );
  }
}
function activate(harnessDir, fid, options = {}) {
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  if (f.status === "done") {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = `${fid} is already done \u2014 no re-activation`;
    return res2;
  }
  warnIfGhost(harnessDir, fid);
  warnIfConcurrent(state, fid);
  state.setActive(fid);
  if (f.status === void 0 || f.status === "planned" || f.status === null) {
    state.setStatus(fid, "in_progress");
  }
  state.setLastCommand(`/harness:work ${fid}`);
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "feature_activated",
    feature: fid,
    status: state.getFeature(fid).status
  });
  autowireInitialSync(harnessDir);
  void options.disableFog;
  autowireKickoff(harnessDir, fid);
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = "activated";
  const routing = resolveRouting(harnessDir, fid);
  res.routed_agents = routing.agents;
  res.parallel_groups = routing.groups;
  return res;
}
function recordGate(harnessDir, fid, gateName, result, options = {}) {
  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  state.recordGateResult(fid, gateName, result, { note: options.note ?? "" });
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "gate_recorded",
    feature: fid,
    gate: gateName,
    result,
    note: options.note ?? ""
  });
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = "gate_recorded";
  return res;
}
function addEvidence(harnessDir, fid, kind, summary) {
  const state = State.load(harnessDir);
  state.addEvidence(fid, kind, summary);
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "evidence_added",
    feature: fid,
    kind,
    summary
  });
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = "evidence_added";
  return res;
}
function block(harnessDir, fid, reason, options = {}) {
  const kind = options.kind ?? "blocker";
  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  state.setStatus(fid, "blocked");
  state.addEvidence(fid, kind, reason);
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "feature_blocked",
    feature: fid,
    reason
  });
  const res = summarize(state, fid);
  res.action = "blocked";
  res.message = reason;
  return res;
}
function projectIsGitRepo(projectRoot) {
  try {
    statSync15(join15(projectRoot, ".git"));
    return true;
  } catch {
    return false;
  }
}
function isHarnessOwnedPath(path) {
  if (path === ".harness/state.yaml") {
    return true;
  }
  if (path.startsWith(".harness/_workspace/")) {
    return true;
  }
  return path === "CHANGELOG.md";
}
function workingTreeDirty(projectRoot) {
  let proc;
  try {
    proc = spawnSync2("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 1e4
    });
  } catch {
    return false;
  }
  if (proc.status !== 0 || typeof proc.stdout !== "string") {
    return false;
  }
  for (const line of proc.stdout.split("\n")) {
    if (line.length < 4) {
      continue;
    }
    let path = line.slice(3);
    if (path.includes(" -> ")) {
      path = path.split(" -> ", 2)[1] ?? path;
    }
    path = path.trim().replace(/^"|"$/g, "");
    if (!isHarnessOwnedPath(path)) {
      return true;
    }
  }
  return false;
}
function complete(harnessDir, fid, options = {}) {
  const hotfixReason = options.hotfixReason ?? null;
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  if (f.status === "done") {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = `${fid} is already done \u2014 no re-completion`;
    return res2;
  }
  const gates = f.gates ?? {};
  const gate5 = gates["gate_5"];
  if (!isPlainObject12(gate5) || gate5["last_result"] !== "pass") {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = `cannot complete \u2014 ${friendlyGate("gate_5")} is not PASS yet`;
    return res2;
  }
  const projectRoot = resolvePath6(harnessDir, "..");
  if (projectIsGitRepo(projectRoot) && workingTreeDirty(projectRoot)) {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = "cannot complete \u2014 working tree has uncommitted user changes. Canonical sequence: --evidence \u2192 git commit \u2192 --complete. Committing while the feature is still in_progress lets the pre-commit hook (F-034) pass naturally; --gate gate_4 may be recorded post-commit if you want the audit trail. (.harness/state.yaml, .harness/_workspace/*, CHANGELOG.md are whitelisted and do not count as dirty.)";
    return res2;
  }
  if (!hotfixReason) {
    try {
      const driftReport = runBlockingCheck(harnessDir);
      const blocking = driftReport.findings.filter(
        (d) => d.severity === "error" && BLOCKING_DRIFT_KINDS.has(d.kind)
      );
      if (blocking.length > 0) {
        const res2 = summarize(state, fid);
        res2.action = "queried";
        const kinds = [...new Set(blocking.map((d) => d.kind))].sort();
        res2.message = `cannot complete \u2014 ${blocking.length} blocking drift(s) (${kinds.join(", ")}). Run \`npm run check -- --harness-dir ${harnessDir}\` for details, fix, or use \`--hotfix-reason\` for emergency.`;
        return res2;
      }
    } catch {
    }
  }
  const spec = loadSpec2(harnessDir);
  const mode = resolveMode(spec);
  const requiredDefault = IRON_LAW_REQUIRED[mode];
  const required = hotfixReason ? 1 : requiredDefault;
  if (mode === "product" && !hotfixReason) {
    const failedGates = [];
    for (const [g, v] of Object.entries(gates)) {
      if (isPlainObject12(v) && v["last_result"] === "fail") {
        failedGates.push(g);
      }
    }
    failedGates.sort();
    if (failedGates.length > 0) {
      const res2 = summarize(state, fid);
      res2.action = "queried";
      res2.message = `cannot complete \u2014 product mode strict: declared gate(s) failing \u2014 ${failedGates.join(", ")}. Re-run with --run-gate after fixing, or use --hotfix-reason for emergency override.`;
      return res2;
    }
  }
  if (hotfixReason !== null && hotfixReason.trim().length === 0) {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = "hotfix reason cannot be empty \u2014 describe the emergency briefly";
    return res2;
  }
  if (hotfixReason !== null) {
    state.addEvidence(fid, "hotfix", hotfixReason.trim());
  }
  const featureNow = state.getFeature(fid) ?? f;
  const declared = countDeclaredEvidence(featureNow, { windowDays: IRON_LAW_WINDOW_DAYS });
  if (declared < required) {
    if (hotfixReason !== null) {
      const evidenceList = featureNow.evidence;
      if (Array.isArray(evidenceList) && evidenceList.length > 0) {
        evidenceList.pop();
      }
      state.save();
    }
    const res2 = summarize(state, fid);
    res2.action = "queried";
    const reasonSuffix = hotfixReason !== null ? ", hotfix" : "";
    res2.message = `cannot complete \u2014 Iron Law: ${declared}/${required} declared evidence in last ${IRON_LAW_WINDOW_DAYS} days (mode: ${mode}${reasonSuffix}). Add more with --evidence, or use --hotfix-reason for emergency override.`;
    return res2;
  }
  state.setStatus(fid, "done");
  if (state.data.session.active_feature_id === fid) {
    state.setActive(null);
  }
  state.save();
  const event = {
    ts: nowIso8(),
    type: "feature_done",
    feature: fid,
    iron_law_mode: mode,
    declared_count: declared,
    required
  };
  if (hotfixReason !== null) {
    event["hotfix_reason"] = hotfixReason.trim();
  }
  appendEvent5(harnessDir, event);
  autowireRetro(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = "completed";
  return res;
}
function archive(harnessDir, fid, options = {}) {
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  const currentStatus = f.status;
  if (currentStatus === "archived") {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = `${fid} is already archived \u2014 no re-archive`;
    return res2;
  }
  if (currentStatus !== "done") {
    const res2 = summarize(state, fid);
    res2.action = "queried";
    res2.message = `cannot archive \u2014 ${fid}.status='${currentStatus}'. Only 'done' features can be archived (shipped is shipped).`;
    return res2;
  }
  let supersededBy = options.supersededBy ?? null;
  if (supersededBy !== null) {
    const sb = supersededBy.trim();
    if (sb.length === 0) {
      const res2 = summarize(state, fid);
      res2.action = "queried";
      res2.message = "--superseded-by cannot be empty";
      return res2;
    }
    if (sb === fid) {
      const res2 = summarize(state, fid);
      res2.action = "queried";
      res2.message = `--superseded-by cannot reference self (${fid})`;
      return res2;
    }
    const spec = loadSpec2(harnessDir) ?? {};
    const specIds = /* @__PURE__ */ new Set();
    for (const entry of spec["features"] ?? []) {
      if (isPlainObject12(entry) && typeof entry["id"] === "string") {
        specIds.add(entry["id"]);
      }
    }
    if (!specIds.has(sb)) {
      const res2 = summarize(state, fid);
      res2.action = "queried";
      res2.message = `--superseded-by ${sb} not found in spec.yaml features[]. Add the replacement feature to spec first.`;
      return res2;
    }
    supersededBy = sb;
  }
  state.setStatus(fid, "archived");
  if (state.data.session.active_feature_id === fid) {
    state.setActive(null);
  }
  state.save();
  const event = {
    ts: nowIso8(),
    type: "feature_archived",
    feature: fid
  };
  if (supersededBy !== null && supersededBy !== "") {
    event["superseded_by"] = supersededBy;
  }
  if (options.reason !== void 0 && options.reason !== null) {
    event["reason"] = options.reason.trim();
  }
  appendEvent5(harnessDir, event);
  autowireRetro(harnessDir, fid, true);
  const res = summarize(state, fid);
  res.action = "archived";
  const suffixParts = [];
  if (supersededBy !== null && supersededBy !== "") {
    suffixParts.push(`superseded_by=${supersededBy}`);
  }
  if (options.reason) {
    suffixParts.push(`reason='${options.reason.trim()}'`);
  }
  const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(", ")})` : "";
  res.message = `${fid} archived${suffix}`;
  return res;
}
function current(harnessDir) {
  const state = State.load(harnessDir);
  const fid = state.data.session.active_feature_id;
  if (typeof fid !== "string" || fid.length === 0) {
    return null;
  }
  const res = summarize(state, fid);
  res.action = "queried";
  return res;
}
function deactivate(harnessDir) {
  const state = State.load(harnessDir);
  const fid = state.data.session.active_feature_id;
  if (typeof fid !== "string" || fid.length === 0) {
    return {
      feature_id: "",
      action: "queried",
      current_status: "",
      gates_passed: [],
      gates_failed: [],
      evidence_count: 0,
      message: "no active feature to deactivate",
      routed_agents: [],
      parallel_groups: []
    };
  }
  state.setActive(null);
  state.save();
  appendEvent5(harnessDir, { ts: nowIso8(), type: "feature_deactivated", feature: fid });
  const res = summarize(state, fid);
  res.action = "deactivated";
  return res;
}
function removeFeature(harnessDir, fid) {
  const state = State.load(harnessDir);
  const f = state.getFeature(fid);
  if (f === null) {
    return {
      feature_id: fid,
      action: "queried",
      current_status: "",
      gates_passed: [],
      gates_failed: [],
      evidence_count: 0,
      message: `${fid} not in state \u2014 nothing to remove`,
      routed_agents: [],
      parallel_groups: []
    };
  }
  if (f.status === "done") {
    const res = summarize(state, fid);
    res.action = "queried";
    res.message = `cannot remove ${fid} \u2014 feature is done (audit trail protected)`;
    return res;
  }
  state.removeFeature(fid);
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "feature_removed",
    feature: fid,
    prior_status: f.status
  });
  return {
    feature_id: fid,
    action: "removed",
    current_status: "",
    gates_passed: [],
    gates_failed: [],
    evidence_count: 0,
    message: `${fid} removed from state`,
    routed_agents: [],
    parallel_groups: []
  };
}
function formatPerformanceBudget(budget) {
  if (!isPlainObject12(budget) || Object.keys(budget).length === 0) {
    return "";
  }
  const parts = [];
  const standard = ["lcp_ms", "inp_ms", "cls", "bundle_kb", "latency_p95_ms", "memory_rss_mb"];
  for (const key of standard) {
    if (key in budget) {
      parts.push(`${key}=${budget[key]}`);
    }
  }
  const custom = budget["custom"];
  if (Array.isArray(custom)) {
    for (const entry of custom) {
      if (isPlainObject12(entry) && "metric" in entry && "budget" in entry) {
        parts.push(`${entry["metric"]}=${entry["budget"]}`);
      }
    }
  }
  return parts.join(" \xB7 ");
}
function runAndRecordGate(harnessDir, fid, gateName, options = {}) {
  const projectRoot = options.projectRoot ?? resolvePath6(harnessDir, "..");
  const addEvidenceOnPass = options.addEvidenceOnPass ?? true;
  const runResult = runGate(gateName, projectRoot, {
    overrideCommand: options.overrideCommand ?? null,
    harnessDir,
    timeoutSec: options.timeoutSec ?? 300
  });
  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  let note = runResult.reason;
  if (!note && runResult.command.length > 0) {
    note = `cmd: ${runResult.command.join(" ")}`;
  }
  state.recordGateResult(fid, gateName, runResult.result, { note });
  if (runResult.result === "pass" && addEvidenceOnPass) {
    let summary = `Gate ${gateName} pass (${runResult.durationSec.toFixed(1)}s)`;
    if (runResult.command.length > 0) {
      summary += ` \xB7 cmd: ${runResult.command.join(" ")}`;
    }
    if (gateName === "gate_perf") {
      const spec = loadSpec2(harnessDir);
      const feature = spec !== null ? findFeature(spec, fid) : null;
      const budgetSummary = formatPerformanceBudget(
        feature !== null ? feature["performance_budget"] : null
      );
      if (budgetSummary.length > 0) {
        summary += ` \xB7 budget: ${budgetSummary}`;
      }
    }
    state.addEvidence(fid, "gate_run", summary);
  }
  state.save();
  appendEvent5(harnessDir, {
    ts: nowIso8(),
    type: "gate_auto_run",
    feature: fid,
    gate: gateName,
    result: runResult.result,
    exit_code: runResult.exitCode,
    duration_sec: Math.round(runResult.durationSec * 1e3) / 1e3,
    reason: runResult.reason
  });
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = "gate_auto_run";
  res.message = `${friendlyGate(gateName)} ${runResult.result.toUpperCase()}` + (runResult.reason ? ` \u2014 ${runResult.reason}` : "");
  return res;
}
var import_yaml12, GATE_FRIENDLY, IRON_LAW_REQUIRED, BLOCKING_DRIFT_KINDS;
var init_work = __esm({
  "src/work.ts"() {
    "use strict";
    import_yaml12 = __toESM(require_dist(), 1);
    init_check();
    init_gates();
    init_projectMode();
    init_state();
    init_designReview();
    init_kickoff();
    init_retro();
    init_runner();
    init_sync();
    GATE_FRIENDLY = {
      gate_0: "tests",
      gate_1: "type check",
      gate_2: "lint",
      gate_3: "coverage",
      gate_4: "commit check",
      gate_5: "smoke run",
      gate_perf: "performance"
    };
    IRON_LAW_REQUIRED = { prototype: 1, product: 3 };
    BLOCKING_DRIFT_KINDS = /* @__PURE__ */ new Set([
      "Code",
      "Stale",
      "AnchorIntegration",
      "Coverage"
    ]);
  }
});

// src/drive/goalStore.ts
import { createHash as createHash4 } from "node:crypto";
import { readFileSync as readFileSync15, writeFileSync as writeFileSync7 } from "node:fs";
function nowIso9(now = /* @__PURE__ */ new Date()) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function isPlainObject13(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nextGoalId(existing) {
  let max = 0;
  for (const id of existing) {
    const m = /^G-(\d+)$/.exec(id);
    if (m === null) {
      continue;
    }
    const n = Number.parseInt(m[1] ?? "0", 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  const next = max + 1;
  return `G-${next.toString().padStart(3, "0")}`;
}
function normalizeSlug(title) {
  const ascii = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (ascii.length > 0 && /^[a-z0-9]/.test(ascii)) {
    return ascii.length > MAX_SLUG_LENGTH ? ascii.slice(0, MAX_SLUG_LENGTH) : ascii;
  }
  const hash = createHash4("sha256").update(title, "utf8").digest("hex").slice(0, 8);
  return `goal-${hash}`;
}
function readGoals(specPath) {
  const raw = readFileSync15(specPath, "utf-8");
  const doc = (0, import_yaml13.parse)(raw);
  if (!isPlainObject13(doc)) {
    return [];
  }
  const goals = doc.goals;
  if (!Array.isArray(goals)) {
    return [];
  }
  const out = [];
  for (const g of goals) {
    if (!isPlainObject13(g)) {
      continue;
    }
    if (typeof g.id !== "string" || typeof g.title !== "string") {
      continue;
    }
    const slug = typeof g.slug === "string" ? g.slug : normalizeSlug(g.title);
    const featureIds = Array.isArray(g.feature_ids) ? g.feature_ids.filter((x) => typeof x === "string") : [];
    out.push({
      ...g,
      id: g.id,
      slug,
      title: g.title,
      feature_ids: featureIds
    });
  }
  return out;
}
function createGoal(input, existingIds) {
  const id = nextGoalId(existingIds);
  const slug = normalizeSlug(input.title);
  const goal = {
    id,
    slug,
    title: input.title,
    feature_ids: [...input.feature_ids ?? []],
    created_at: nowIso9(input.now),
    archived_at: null,
    archive_reason: null
  };
  if (typeof input.description === "string" && input.description.length > 0) {
    goal.description = input.description;
  }
  return goal;
}
var import_yaml13, MAX_SLUG_LENGTH;
var init_goalStore = __esm({
  "src/drive/goalStore.ts"() {
    "use strict";
    import_yaml13 = __toESM(require_dist(), 1);
    MAX_SLUG_LENGTH = 60;
  }
});

// src/drive/progressRenderer.ts
function isPlainObject14(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function featureIcon(status, emoji) {
  if (!emoji) {
    const map2 = {
      done: "[x]",
      in_progress: "[>]",
      planned: "[ ]",
      blocked: "[!]",
      archived: "[~]"
    };
    return map2[status] ?? "[ ]";
  }
  const map = {
    done: "\u2705",
    in_progress: "\u{1F535}",
    planned: "\u26AA",
    blocked: "\u26A0",
    archived: "\u{1F5C4}"
  };
  return map[status] ?? "\u26AA";
}
function countGatesPassed2(feature) {
  if (!isPlainObject14(feature.gates)) {
    return 0;
  }
  let count = 0;
  for (const g of STANDARD_GATES3) {
    const entry = feature.gates[g];
    if (isPlainObject14(entry) && entry.last_result === "pass") {
      count += 1;
    }
  }
  return count;
}
function countDeclaredEvidence2(feature) {
  if (!Array.isArray(feature.evidence)) {
    return 0;
  }
  let count = 0;
  for (const ev of feature.evidence) {
    if (!isPlainObject14(ev)) {
      continue;
    }
    const kind = ev.kind;
    if (typeof kind === "string" && (kind === "gate_run" || kind === "gate_auto_run")) {
      continue;
    }
    count += 1;
  }
  return count;
}
function elapsedMinutes(startedAt, now) {
  if (typeof startedAt !== "string" || startedAt.length === 0) {
    return null;
  }
  const ms = Date.parse(startedAt);
  if (Number.isNaN(ms)) {
    return null;
  }
  const diff = now.getTime() - ms;
  if (diff < 0) {
    return 0;
  }
  return Math.round(diff / 6e4);
}
function elapsedMinutesFromSec(elapsed_sec) {
  if (typeof elapsed_sec !== "number" || !Number.isFinite(elapsed_sec) || elapsed_sec < 0) {
    return null;
  }
  return Math.round(elapsed_sec / 60);
}
function computePercentDone(features) {
  if (features.length === 0) {
    return 0;
  }
  let done = 0;
  for (const f of features) {
    if (f.status === "done") {
      done += 1;
    }
  }
  return Math.round(done / features.length * 100);
}
function inflightGateLabel(feature) {
  if (feature.status !== "in_progress") {
    return null;
  }
  for (const g of STANDARD_GATES3) {
    const entry = feature.gates?.[g];
    if (!isPlainObject14(entry)) {
      return g;
    }
    if (entry.last_result !== "pass") {
      return g;
    }
  }
  return null;
}
function renderProgress(input, options = {}) {
  const { goalSpec, goalRuntime, features } = input;
  const emoji = options.emoji ?? true;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const percentDone = computePercentDone(features);
  const goalIcon = emoji ? "\u{1F4CA}" : "##";
  const status = goalRuntime?.status ?? "planning";
  const lines = [];
  lines.push(`${goalIcon} Goal ${goalSpec.id}: ${goalSpec.title} (${percentDone}%) [${status}]`);
  for (const f of features) {
    const icon = featureIcon(f.status, emoji);
    const passed = countGatesPassed2(f);
    const declared = countDeclaredEvidence2(f);
    const inflight = inflightGateLabel(f);
    const elapsed = elapsedMinutes(f.started_at, now);
    const parts = [];
    parts.push(`${f.status}`);
    if (inflight !== null) {
      parts.push(`${inflight} running`);
    } else if (passed > 0) {
      parts.push(`${passed}/${STANDARD_GATES3.length} gates`);
    }
    if (declared > 0) {
      parts.push(`${declared} evidence`);
    }
    if (elapsed !== null && f.status !== "planned") {
      parts.push(`${elapsed}m`);
    }
    const fname = featureName(f);
    lines.push(`  ${icon} ${f.id} ${fname} [${parts.join(" \xB7 ")}]`);
  }
  const activeFeature = features.find((f) => f.status === "in_progress") ?? null;
  const iteration = goalRuntime?.iteration ?? 0;
  const elapsedGoal = elapsedMinutesFromSec(goalRuntime?.elapsed_sec);
  const lastHalt = goalRuntime?.last_halt_reason ?? null;
  if (activeFeature !== null) {
    const inflight = inflightGateLabel(activeFeature);
    const phase = inflight !== null ? `${inflight} (running)` : "awaiting evidence";
    const arrow = emoji ? "\u25B6" : ">";
    const elapsedSegment = elapsedGoal !== null ? ` \xB7 ${elapsedGoal}m elapsed` : "";
    const haltSegment = lastHalt !== null ? ` \xB7 last halt: ${lastHalt}` : "";
    lines.push(
      `${arrow} now: ${activeFeature.id} / ${phase} \xB7 iteration ${iteration}${elapsedSegment}${haltSegment}`
    );
  } else {
    const arrow = emoji ? "\u25B6" : ">";
    const elapsedSegment = elapsedGoal !== null ? ` \xB7 ${elapsedGoal}m elapsed` : "";
    lines.push(`${arrow} now: idle \xB7 iteration ${iteration}${elapsedSegment}`);
  }
  return lines.join("\n");
}
function renderProgressJson(input, options = {}) {
  const { goalSpec, goalRuntime, features } = input;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const featuresJson = features.map((f) => ({
    id: f.id,
    status: f.status,
    gates_passed: countGatesPassed2(f),
    evidence_count: countDeclaredEvidence2(f),
    elapsed_min: elapsedMinutes(f.started_at, now)
  }));
  return {
    goal_id: goalSpec.id,
    title: goalSpec.title,
    status: goalRuntime?.status ?? "planning",
    percent_done: computePercentDone(features),
    features: featuresJson,
    iteration: goalRuntime?.iteration ?? 0,
    elapsed_min: elapsedMinutesFromSec(goalRuntime?.elapsed_sec),
    last_halt_reason: goalRuntime?.last_halt_reason ?? null
  };
}
function featureName(feature) {
  const n = feature.name;
  return typeof n === "string" && n.length > 0 ? n : "";
}
var STANDARD_GATES3;
var init_progressRenderer = __esm({
  "src/drive/progressRenderer.ts"() {
    "use strict";
    STANDARD_GATES3 = ["gate_0", "gate_1", "gate_2", "gate_3", "gate_5"];
  }
});

// src/drive/statusCommand.ts
var statusCommand_exports = {};
__export(statusCommand_exports, {
  composeStatusJson: () => composeStatusJson,
  composeStatusText: () => composeStatusText,
  runDriveStatus: () => runDriveStatus
});
import { existsSync as existsSync4, readFileSync as readFileSync16 } from "node:fs";
import { join as join16 } from "node:path";
function isPlainObject15(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readSpecFeatures(harnessDir) {
  const path = join16(harnessDir, "spec.yaml");
  if (!existsSync4(path)) {
    return [];
  }
  const raw = readFileSync16(path, "utf-8");
  const doc = (0, import_yaml14.parse)(raw);
  if (!isPlainObject15(doc)) {
    return [];
  }
  if (!Array.isArray(doc.features)) {
    return [];
  }
  return doc.features.filter(isPlainObject15);
}
function enrichFeatures(runtimeFeatures, specFeatures) {
  const nameById = /* @__PURE__ */ new Map();
  for (const f of specFeatures) {
    if (typeof f.id === "string" && typeof f.name === "string") {
      nameById.set(f.id, f.name);
    }
  }
  return runtimeFeatures.map((f) => {
    const name = nameById.get(f.id);
    return name === void 0 ? f : { ...f, name };
  });
}
function resolveGoalFeatures(state, goalSpec, specFeatures) {
  const runtimeById = /* @__PURE__ */ new Map();
  for (const f of state.data.features ?? []) {
    if (isPlainObject15(f) && typeof f.id === "string") {
      runtimeById.set(f.id, f);
    }
  }
  const out = [];
  for (const fid of goalSpec.feature_ids) {
    const existing = runtimeById.get(fid);
    if (existing !== void 0) {
      out.push(existing);
      continue;
    }
    out.push({
      id: fid,
      status: "planned",
      gates: {},
      evidence: [],
      started_at: null,
      completed_at: null
    });
  }
  return enrichFeatures(out, specFeatures);
}
function selectGoals(goals, state, options) {
  if (options.all === true) {
    return [...goals];
  }
  if (typeof options.goalId === "string" && options.goalId.length > 0) {
    const found = goals.find((g) => g.id === options.goalId);
    return found === void 0 ? [] : [found];
  }
  const active = state.activeGoalId();
  if (active !== null) {
    const found = goals.find((g) => g.id === active);
    if (found !== void 0) {
      return [found];
    }
  }
  if (goals.length > 0) {
    return [goals[goals.length - 1]];
  }
  return [];
}
function composeStatusText(goals, state, specFeatures, options) {
  const selected = selectGoals(goals, state, options);
  if (selected.length === 0) {
    return 'no goals registered yet \u2014 drive --plan or /harness-boot:drive "<goal>" (stage 2 / F-119)';
  }
  const blocks = [];
  for (const goalSpec of selected) {
    const goalRuntime = state.getGoal(goalSpec.id);
    const features = resolveGoalFeatures(state, goalSpec, specFeatures);
    blocks.push(renderProgress({ goalSpec, goalRuntime, features }));
  }
  return blocks.join("\n\n");
}
function composeStatusJson(goals, state, specFeatures, options) {
  const selected = selectGoals(goals, state, options);
  const out = [];
  for (const goalSpec of selected) {
    const goalRuntime = state.getGoal(goalSpec.id);
    const features = resolveGoalFeatures(state, goalSpec, specFeatures);
    out.push(renderProgressJson({ goalSpec, goalRuntime, features }));
  }
  return { goals: out };
}
function sleep(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
async function runDriveStatus(options) {
  const out = options.out ?? ((s) => process.stdout.write(s));
  const harnessDir = options.harnessDir;
  if (!existsSync4(harnessDir)) {
    out(`drive --status: harness dir not found: ${harnessDir}
`);
    return 2;
  }
  const intervalSec = options.intervalSec ?? 2;
  const watch = options.watch ?? false;
  const renderOnce = () => {
    const specPath = join16(harnessDir, "spec.yaml");
    const goals = existsSync4(specPath) ? readGoals(specPath) : [];
    const specFeatures = readSpecFeatures(harnessDir);
    const state = State.load(harnessDir);
    if (options.json === true) {
      const payload = composeStatusJson(goals, state, specFeatures, options);
      out(JSON.stringify(payload, null, 2) + "\n");
    } else {
      const text = composeStatusText(goals, state, specFeatures, options);
      out(text + "\n");
    }
  };
  if (!watch) {
    renderOnce();
    return 0;
  }
  while (true) {
    if (options.json !== true) {
      out("\x1B[2J\x1B[H");
    }
    renderOnce();
    await sleep(intervalSec * 1e3);
  }
}
var import_yaml14;
var init_statusCommand = __esm({
  "src/drive/statusCommand.ts"() {
    "use strict";
    import_yaml14 = __toESM(require_dist(), 1);
    init_state();
    init_goalStore();
    init_progressRenderer();
  }
});

// src/drive/checkpoint.ts
var checkpoint_exports = {};
__export(checkpoint_exports, {
  DEFAULT_MAX_ITERATIONS: () => DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_SECONDS: () => DEFAULT_MAX_SECONDS,
  appendProgress: () => appendProgress,
  checkpointPath: () => checkpointPath,
  clearCheckpoint: () => clearCheckpoint,
  defaultCheckpoint: () => defaultCheckpoint,
  goalArtifactDir: () => goalArtifactDir,
  loadCheckpoint: () => loadCheckpoint,
  progressLogPath: () => progressLogPath,
  saveCheckpoint: () => saveCheckpoint,
  stopFileExists: () => stopFileExists,
  stopFilePath: () => stopFilePath
});
import { appendFileSync as appendFileSync7, existsSync as existsSync5, mkdirSync as mkdirSync7, readFileSync as readFileSync17, statSync as statSync16, writeFileSync as writeFileSync8 } from "node:fs";
import { dirname as dirname9, join as join17 } from "node:path";
function isPlainObject16(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nowIso10(now = /* @__PURE__ */ new Date()) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function checkpointPath(harnessDir) {
  return join17(harnessDir, "_workspace", "drive", "run.yaml");
}
function progressLogPath(harnessDir) {
  return join17(harnessDir, "_workspace", "drive", "progress.log");
}
function stopFilePath(harnessDir) {
  return join17(harnessDir, "_workspace", "drive", "STOP");
}
function goalArtifactDir(harnessDir, goalId) {
  return join17(harnessDir, "_workspace", "drive", "goals", goalId);
}
function defaultCheckpoint(goalId, now = /* @__PURE__ */ new Date()) {
  const ts = nowIso10(now);
  return {
    goal_id: goalId,
    phase: "planning",
    plan: {
      brief_path: "",
      brief_approved: false,
      plan_path: "",
      plan_approved: false,
      scaffolded_features: []
    },
    execute: {
      started_at: null,
      iteration: 0,
      elapsed_sec: 0,
      active_feature: null,
      retry_counts: {},
      max_iterations: DEFAULT_MAX_ITERATIONS,
      max_seconds: DEFAULT_MAX_SECONDS
    },
    last_halt: null,
    created_at: ts,
    updated_at: ts
  };
}
function loadCheckpoint(harnessDir) {
  const path = checkpointPath(harnessDir);
  if (!existsSync5(path)) {
    return null;
  }
  let raw;
  try {
    raw = readFileSync17(path, "utf-8");
  } catch {
    return null;
  }
  const parsed = (0, import_yaml15.parse)(raw);
  if (!isPlainObject16(parsed)) {
    return null;
  }
  if (typeof parsed.goal_id !== "string" || parsed.goal_id.length === 0) {
    return null;
  }
  const seed = defaultCheckpoint(parsed.goal_id);
  const merged = {
    ...seed,
    ...parsed
  };
  if (!isPlainObject16(merged.plan)) {
    merged.plan = seed.plan;
  } else {
    merged.plan = { ...seed.plan, ...merged.plan };
  }
  if (!isPlainObject16(merged.execute)) {
    merged.execute = seed.execute;
  } else {
    merged.execute = { ...seed.execute, ...merged.execute };
  }
  if (!isPlainObject16(merged.last_halt) && merged.last_halt !== null) {
    merged.last_halt = null;
  }
  return merged;
}
function saveCheckpoint(harnessDir, checkpoint, now = /* @__PURE__ */ new Date()) {
  const path = checkpointPath(harnessDir);
  mkdirSync7(dirname9(path), { recursive: true });
  const out = { ...checkpoint, updated_at: nowIso10(now) };
  const text = (0, import_yaml15.stringify)(out, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0
  });
  writeFileSync8(path, text, "utf-8");
}
function clearCheckpoint(harnessDir) {
  const path = checkpointPath(harnessDir);
  if (!existsSync5(path)) {
    return false;
  }
  try {
    statSync16(path);
  } catch {
    return false;
  }
  const { rmSync } = __require("node:fs");
  rmSync(path, { force: true });
  return true;
}
function appendProgress(harnessDir, line) {
  const path = progressLogPath(harnessDir);
  mkdirSync7(dirname9(path), { recursive: true });
  const ending = line.endsWith("\n") ? "" : "\n";
  appendFileSync7(path, line + ending, "utf-8");
}
function stopFileExists(harnessDir) {
  return existsSync5(stopFilePath(harnessDir));
}
var import_yaml15, DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_SECONDS;
var init_checkpoint = __esm({
  "src/drive/checkpoint.ts"() {
    "use strict";
    import_yaml15 = __toESM(require_dist(), 1);
    DEFAULT_MAX_ITERATIONS = 50;
    DEFAULT_MAX_SECONDS = 7200;
  }
});

// src/drive/halt.ts
import { appendFileSync as appendFileSync8, mkdirSync as mkdirSync8 } from "node:fs";
import { dirname as dirname10, join as join18 } from "node:path";
function isPlainObject17(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nowIso11(now = /* @__PURE__ */ new Date()) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function appendEvent6(harnessDir, event) {
  const logPath = join18(harnessDir, "events.log");
  mkdirSync8(dirname10(logPath), { recursive: true });
  const json = JSON.stringify(event);
  appendFileSync8(logPath, `${json}
`, "utf-8");
}
function emitHalt(harnessDir, reason, message, context = {}) {
  const ts = nowIso11(context.now);
  const index = HALT_REASON_INDEX[reason];
  const ck = loadCheckpoint(harnessDir);
  if (ck !== null) {
    ck.last_halt = { reason, message, ts };
    if (typeof context.iteration === "number") {
      ck.execute.iteration = context.iteration;
    }
    if (typeof context.feature_id === "string") {
      ck.execute.active_feature = context.feature_id;
    }
    saveCheckpoint(harnessDir, ck, context.now);
  }
  const featureSegment = typeof context.feature_id === "string" ? ` \xB7 ${context.feature_id}` : "";
  const gateSegment = typeof context.gate === "string" ? ` \xB7 ${context.gate}` : "";
  appendProgress(
    harnessDir,
    `${ts} HALT #${index.n} ${index.tag}${featureSegment}${gateSegment}: ${message}`
  );
  const event = {
    ts,
    type: "drive_halted",
    reason,
    halt_n: index.n,
    halt_tag: index.tag,
    message
  };
  if (ck !== null) {
    event.goal_id = ck.goal_id;
  } else if (typeof context.goal_id === "string") {
    event.goal_id = context.goal_id;
  }
  if (typeof context.feature_id === "string") {
    event.feature_id = context.feature_id;
  }
  if (typeof context.gate === "string") {
    event.gate = context.gate;
  }
  if (Array.isArray(context.findings)) {
    event.findings_count = context.findings.length;
  }
  if (typeof context.iteration === "number") {
    event.iteration = context.iteration;
  }
  for (const [key, value] of Object.entries(context)) {
    if (key in event || key === "now" || key === "findings") {
      continue;
    }
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      event[key] = value;
    } else if (isPlainObject17(value) || Array.isArray(value)) {
      try {
        event[key] = JSON.parse(JSON.stringify(value));
      } catch {
      }
    }
  }
  appendEvent6(harnessDir, event);
  return { reason, message, ts, index };
}
var HALT_REASON_INDEX;
var init_halt = __esm({
  "src/drive/halt.ts"() {
    "use strict";
    init_checkpoint();
    HALT_REASON_INDEX = {
      plan_phase_approval: { n: 1, tag: "plan-phase approval" },
      commit_boundary: { n: 2, tag: "gate_4 commit boundary" },
      retry_threshold: { n: 3, tag: "gate retry threshold" },
      drift_severity_error: { n: 4, tag: "severity=error drift" },
      feature_blocked: { n: 5, tag: "feature blocked" },
      wall_clock: { n: 6, tag: "wall-clock cap" },
      iteration_cap: { n: 7, tag: "iteration cap" },
      network_failure: { n: 8, tag: "network failure" },
      stop_file: { n: 9, tag: "STOP file" },
      manual: { n: 0, tag: "manual" }
    };
  }
});

// src/drive/planPhase.ts
var planPhase_exports = {};
__export(planPhase_exports, {
  advancePhaseA: () => advancePhaseA,
  briefPathFor: () => briefPathFor,
  planPathFor: () => planPathFor,
  readGoalContext: () => readGoalContext,
  startPhaseA: () => startPhaseA
});
import { existsSync as existsSync6, mkdirSync as mkdirSync9, readFileSync as readFileSync18 } from "node:fs";
import { join as join19 } from "node:path";
function briefPathFor(harnessDir, goalId) {
  return join19(goalArtifactDir(harnessDir, goalId), "brief.md");
}
function planPathFor(harnessDir, goalId) {
  return join19(goalArtifactDir(harnessDir, goalId), "plan.md");
}
function readGoalFromSpec(harnessDir, goalId) {
  const specPath = join19(harnessDir, "spec.yaml");
  if (!existsSync6(specPath)) {
    return null;
  }
  const goals = readGoals(specPath);
  return goals.find((g) => g.id === goalId) ?? null;
}
function allocateGoalId(harnessDir) {
  const specPath = join19(harnessDir, "spec.yaml");
  const specIds = existsSync6(specPath) ? readGoals(specPath).map((g) => g.id) : [];
  const state = State.load(harnessDir);
  const stateIds = state.goals().map((g) => g.id);
  const union = Array.from(/* @__PURE__ */ new Set([...specIds, ...stateIds]));
  return nextGoalId(union);
}
function startPhaseA(input) {
  const { harnessDir, title, now } = input;
  if (!title || title.trim().length === 0) {
    throw new Error("drive plan: goal title is required");
  }
  const goalId = allocateGoalId(harnessDir);
  const state = State.load(harnessDir);
  state.ensureGoal(goalId);
  state.setGoalStatus(goalId, "planning");
  state.setActiveGoal(goalId);
  state.save();
  const goalSpec = createGoal({ title, now }, [goalId]);
  goalSpec.id = goalId;
  const ck = defaultCheckpoint(goalId, now);
  ck.plan.brief_path = briefPathFor(harnessDir, goalId);
  ck.plan.plan_path = planPathFor(harnessDir, goalId);
  saveCheckpoint(harnessDir, ck, now);
  mkdirSync9(goalArtifactDir(harnessDir, goalId), { recursive: true });
  const halt = emitHalt(
    harnessDir,
    "plan_phase_approval",
    `researcher must compose ${ck.plan.brief_path} for goal "${goalSpec.title}". After approval, run \`harness drive --resume\`.`,
    { goal_id: goalId, now }
  );
  return { goalId, briefPath: ck.plan.brief_path, checkpoint: ck, halt };
}
function advancePhaseA(harnessDir, approvals = {}, now = /* @__PURE__ */ new Date()) {
  const ck = loadCheckpoint(harnessDir);
  if (ck === null) {
    return {
      kind: "halt",
      halt: emitHalt(
        harnessDir,
        "manual",
        'no drive checkpoint found \u2014 run `harness drive "<goal>"` first.',
        { now }
      )
    };
  }
  if (ck.phase !== "planning") {
    return {
      kind: "halt",
      halt: emitHalt(
        harnessDir,
        "manual",
        `phase ${ck.phase} is past Phase A \u2014 use --resume for the execute loop.`,
        { goal_id: ck.goal_id, now }
      )
    };
  }
  if (!existsSync6(ck.plan.brief_path)) {
    return {
      kind: "halt",
      briefPath: ck.plan.brief_path,
      halt: emitHalt(
        harnessDir,
        "plan_phase_approval",
        `researcher's brief is missing at ${ck.plan.brief_path}. Have the researcher agent write it, then resume.`,
        { goal_id: ck.goal_id, now }
      )
    };
  }
  if (!ck.plan.brief_approved) {
    if (!approvals.autoApproveBrief && !approvals.autoApproveAll) {
      ck.plan.brief_approved = true;
      saveCheckpoint(harnessDir, ck, now);
      return {
        kind: "halt",
        briefPath: ck.plan.brief_path,
        halt: emitHalt(
          harnessDir,
          "plan_phase_approval",
          `brief.md is present at ${ck.plan.brief_path}. Review, then resume to dispatch product-planner.`,
          { goal_id: ck.goal_id, now }
        )
      };
    }
    ck.plan.brief_approved = true;
    saveCheckpoint(harnessDir, ck, now);
  }
  if (!existsSync6(ck.plan.plan_path)) {
    return {
      kind: "halt",
      briefPath: ck.plan.brief_path,
      planPath: ck.plan.plan_path,
      halt: emitHalt(
        harnessDir,
        "plan_phase_approval",
        `product-planner's plan is missing at ${ck.plan.plan_path}. Have the planner agent write it, then resume.`,
        { goal_id: ck.goal_id, now }
      )
    };
  }
  if (!ck.plan.plan_approved) {
    if (!approvals.autoApproveAll) {
      ck.plan.plan_approved = true;
      saveCheckpoint(harnessDir, ck, now);
      return {
        kind: "halt",
        briefPath: ck.plan.brief_path,
        planPath: ck.plan.plan_path,
        halt: emitHalt(
          harnessDir,
          "plan_phase_approval",
          `plan.md is present at ${ck.plan.plan_path}. Review, then resume to dispatch feature-author for the scaffolding.`,
          { goal_id: ck.goal_id, now }
        )
      };
    }
    ck.plan.plan_approved = true;
    saveCheckpoint(harnessDir, ck, now);
  }
  const goal = readGoalFromSpec(harnessDir, ck.goal_id);
  const scaffolded = goal !== null ? [...goal.feature_ids] : [];
  if (scaffolded.length === 0) {
    return {
      kind: "halt",
      briefPath: ck.plan.brief_path,
      planPath: ck.plan.plan_path,
      halt: emitHalt(
        harnessDir,
        "plan_phase_approval",
        `feature-author has not scaffolded any features for ${ck.goal_id} yet. Author the features into both spec.yaml mirrors with feature-author, then resume.`,
        { goal_id: ck.goal_id, now }
      )
    };
  }
  ck.plan.scaffolded_features = scaffolded;
  ck.phase = "scaffolded";
  saveCheckpoint(harnessDir, ck, now);
  const state = State.load(harnessDir);
  state.setGoalStatus(ck.goal_id, "scaffolded");
  for (const fid of scaffolded) {
    state.setGoalFeatureProgress(ck.goal_id, fid, "planned");
  }
  state.save();
  return { kind: "phase_b_ready", goalId: ck.goal_id, featureIds: scaffolded };
}
function readGoalContext(harnessDir, goalId) {
  const goal = readGoalFromSpec(harnessDir, goalId);
  if (goal !== null) {
    const out = { title: goal.title };
    if (typeof goal.description === "string" && goal.description.length > 0) {
      out.description = goal.description;
    }
    return out;
  }
  const ck = loadCheckpoint(harnessDir);
  if (ck === null || ck.goal_id !== goalId) {
    return null;
  }
  if (existsSync6(ck.plan.brief_path)) {
    const text = readFileSync18(ck.plan.brief_path, "utf-8");
    const heading = /^#\s+(.+)$/m.exec(text);
    if (heading !== null) {
      return { title: heading[1] ?? goalId };
    }
  }
  return null;
}
var init_planPhase = __esm({
  "src/drive/planPhase.ts"() {
    "use strict";
    init_state();
    init_goalStore();
    init_checkpoint();
    init_halt();
  }
});

// src/drive/executor.ts
function mapSuggestion(suggestion) {
  const action = suggestion.action;
  const label = suggestion.label;
  switch (action) {
    case "run_gate": {
      const fid = suggestion.feature_id ?? null;
      const gate = suggestion.gate ?? null;
      if (typeof fid !== "string" || typeof gate !== "string") {
        return {
          kind: "halt",
          reason: "manual",
          message: `intentPlanner returned run_gate without feature_id or gate (label: ${label})`
        };
      }
      return { kind: "run_gate", feature_id: fid, gate, label };
    }
    case "complete": {
      const fid = suggestion.feature_id ?? null;
      if (typeof fid !== "string") {
        return {
          kind: "halt",
          reason: "manual",
          message: `intentPlanner returned complete without feature_id (label: ${label})`
        };
      }
      return { kind: "complete", feature_id: fid, label };
    }
    case "start_feature": {
      const fid = suggestion.feature_id ?? null;
      if (typeof fid !== "string") {
        return {
          kind: "halt",
          reason: "manual",
          message: `intentPlanner returned start_feature without feature_id (label: ${label})`
        };
      }
      return { kind: "activate", feature_id: fid, label };
    }
    // BR-015 (a) — drive cannot manufacture declared evidence on the
    // user's behalf. add_evidence is a *signal* from the planner that
    // the Iron Law floor isn't met yet; the loop must yield.
    case "add_evidence":
      return {
        kind: "halt",
        reason: "manual",
        message: 'declared evidence required (BR-015 \u2014 drive does not self-issue evidence). add an evidence row with `harness work F-N --evidence "..."` then resume.',
        feature_id: suggestion.feature_id ?? null
      };
    // Coverage carry-forward — surface a human review halt.
    case "review_carry_forward":
      return {
        kind: "halt",
        reason: "manual",
        message: "coverage threshold not met \u2014 review and acknowledge before continuing.",
        feature_id: suggestion.feature_id ?? null
      };
    // Block resolution and failure analysis are LLM-or-human territory.
    case "analyze_fail":
    case "resolve_block":
      return { kind: "llm_required", suggestion };
    // Spec changes (init_feature) live in Phase A, not Phase B.
    case "init_feature":
      return {
        kind: "halt",
        reason: "manual",
        message: "spec.yaml change required \u2014 return to Phase A (drive --plan-only) or use feature-author to register the new feature."
      };
    // No-op signals from the planner.
    case "resume":
    case "deactivate":
      return {
        kind: "halt",
        reason: "manual",
        message: `planner suggested ${action}; drive yields to the user.`
      };
    default:
      return {
        kind: "halt",
        reason: "manual",
        message: `unknown planner action: ${String(action)}`
      };
  }
}
function executeAction(harnessDir, action, hooks = {}) {
  const runGateImpl = hooks.runGate ?? runAndRecordGate;
  const completeImpl = hooks.complete ?? complete;
  const activateImpl = hooks.activate ?? activate;
  switch (action.kind) {
    case "run_gate": {
      const work = runGateImpl(harnessDir, action.feature_id, action.gate);
      const failed = Array.isArray(work.gates_failed) && work.gates_failed.includes(action.gate);
      if (failed) {
        return {
          action,
          proceed: true,
          // surface the fail to the loop, retry-counter increments
          work
        };
      }
      return { action, proceed: true, work };
    }
    case "complete": {
      const work = completeImpl(harnessDir, action.feature_id, { hotfixReason: null });
      if (work.action === "completed") {
        return { action, proceed: true, work };
      }
      return {
        action,
        proceed: false,
        work,
        halt: {
          reason: "manual",
          message: work.message || "Iron Law not satisfied \u2014 drive cannot self-issue --hotfix-reason (BR-015)."
        }
      };
    }
    case "activate": {
      const work = activateImpl(harnessDir, action.feature_id);
      return { action, proceed: true, work };
    }
    case "halt":
      return {
        action,
        proceed: false,
        halt: { reason: action.reason, message: action.message }
      };
    case "llm_required":
      return {
        action,
        proceed: false,
        halt: {
          reason: "manual",
          message: `${action.suggestion.action} requires user/LLM judgment \u2014 yielding (label: ${action.suggestion.label}).`
        }
      };
    default: {
      const _exhaustive = action;
      void _exhaustive;
      return {
        action: { kind: "halt", reason: "manual", message: "unreachable executor branch" },
        proceed: false
      };
    }
  }
}
var init_executor = __esm({
  "src/drive/executor.ts"() {
    "use strict";
    init_work();
  }
});

// src/drive/goalRetro.ts
import { appendFileSync as appendFileSync9, existsSync as existsSync7, mkdirSync as mkdirSync10, readFileSync as readFileSync19, writeFileSync as writeFileSync9 } from "node:fs";
import { dirname as dirname11, join as join20 } from "node:path";
function goalRetroPath(harnessDir, goalId) {
  return join20(goalArtifactDir(harnessDir, goalId), "retro.md");
}
function isPlainObject18(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nowIso12(now = /* @__PURE__ */ new Date()) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function firstGateToFail(feature) {
  const order = ["gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5"];
  if (!isPlainObject18(feature.gates)) {
    return null;
  }
  for (const g of order) {
    const entry = feature.gates[g];
    if (isPlainObject18(entry) && entry.last_result === "fail") {
      return g;
    }
  }
  return null;
}
function countHaltsFromProgressLog(harnessDir) {
  const path = progressLogPath(harnessDir);
  if (!existsSync7(path)) {
    return { total: 0, perReason: {} };
  }
  const text = readFileSync19(path, "utf-8");
  const counts = {};
  let total = 0;
  for (const line of text.split("\n")) {
    const m = /HALT #(\d+) (\S+)/.exec(line);
    if (m === null) {
      continue;
    }
    const tag = `#${m[1]} ${m[2]}`;
    counts[tag] = (counts[tag] ?? 0) + 1;
    total += 1;
  }
  return { total, perReason: counts };
}
function featureRetroPreview(harnessDir, fid) {
  const path = join20(harnessDir, "_workspace", "retro", `${fid}.md`);
  if (!existsSync7(path)) {
    return null;
  }
  const text = readFileSync19(path, "utf-8");
  const lines = text.split("\n").slice(0, 5);
  return lines.join("\n").trim();
}
function appendEvent7(harnessDir, event) {
  const logPath = join20(harnessDir, "events.log");
  mkdirSync10(dirname11(logPath), { recursive: true });
  appendFileSync9(logPath, `${JSON.stringify(event)}
`, "utf-8");
}
function composeRetro(goalSpec, features, halts, iteration, elapsedSec, startedAt, completedAt, harnessDir) {
  const lines = [];
  lines.push(`# Goal Retro \u2014 ${goalSpec.id} \xB7 ${goalSpec.title}`);
  lines.push("");
  lines.push(`> auto-generated by drive's Phase C. Edit the LLM sections below; machine sections regenerate on \`--retro\`.`);
  lines.push("");
  lines.push("## Goal summary");
  lines.push("");
  lines.push(`- **Slug**: ${goalSpec.slug}`);
  lines.push(`- **Started at**: ${startedAt ?? "unknown"}`);
  lines.push(`- **Completed at**: ${completedAt ?? "unknown"}`);
  lines.push(`- **Iterations**: ${iteration}`);
  lines.push(`- **Elapsed (sec)**: ${elapsedSec}`);
  lines.push(`- **Features (${features.length})**: ${features.map((f) => f.id).join(", ")}`);
  lines.push("");
  lines.push("## Feature breakdown");
  lines.push("");
  lines.push("| Feature | Status | First gate to fail | Started | Completed |");
  lines.push("|---|---|---|---|---|");
  for (const f of features) {
    const ff = firstGateToFail(f) ?? "\u2014";
    const started = (f.started_at ?? "").toString() || "\u2014";
    const completed = (f.completed_at ?? "").toString() || "\u2014";
    lines.push(`| ${f.id} | ${f.status} | ${ff} | ${started} | ${completed} |`);
  }
  lines.push("");
  let anyPreview = false;
  for (const f of features) {
    const preview = featureRetroPreview(harnessDir, f.id);
    if (preview === null) {
      continue;
    }
    if (!anyPreview) {
      lines.push("### Per-feature retro previews");
      lines.push("");
      anyPreview = true;
    }
    lines.push(`**${f.id}** (head 5 lines of \`_workspace/retro/${f.id}.md\`):`);
    lines.push("");
    lines.push("```");
    lines.push(preview);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Halt log");
  lines.push("");
  if (halts.total === 0) {
    lines.push("No halts during this goal \u2014 the loop ran clean.");
  } else {
    lines.push(`Total halts: **${halts.total}**`);
    lines.push("");
    lines.push("| Reason | Count |");
    lines.push("|---|---|");
    const sorted = Object.entries(halts.perReason).sort(([a], [b]) => a.localeCompare(b));
    for (const [reason, count] of sorted) {
      lines.push(`| ${reason} | ${count} |`);
    }
  }
  lines.push("");
  lines.push("## Reviewer Reflection");
  lines.push("");
  lines.push("_(pending \u2014 reviewer agent fills this in)_");
  lines.push("");
  lines.push("Suggested prompts:");
  lines.push("- What surprised you about how this goal unfolded?");
  lines.push("- Which halts were avoidable; which were structural?");
  lines.push("- One thing this goal would have benefitted from doing differently.");
  lines.push("");
  lines.push("## Copy Polish");
  lines.push("");
  lines.push("_(pending \u2014 tech-writer agent polishes the prose above)_");
  lines.push("");
  return lines.join("\n");
}
function generateGoalRetro(harnessDir, goalId, options = {}) {
  const path = goalRetroPath(harnessDir, goalId);
  const force = options.force ?? false;
  if (existsSync7(path) && !force) {
    return { path, created: false, feature_count: 0, halt_count: 0 };
  }
  const specPath = join20(harnessDir, "spec.yaml");
  const goals = existsSync7(specPath) ? readGoals(specPath) : [];
  const goalSpec = goals.find((g) => g.id === goalId);
  if (goalSpec === void 0) {
    throw new Error(`drive goalRetro: ${goalId} not found in spec.yaml`);
  }
  const state = State.load(harnessDir);
  const features = [];
  for (const fid of goalSpec.feature_ids) {
    const f = state.getFeature(fid);
    if (f !== null) {
      features.push(f);
    }
  }
  const ck = loadCheckpoint(harnessDir);
  const iteration = ck?.execute.iteration ?? 0;
  const elapsedSec = ck?.execute.elapsed_sec ?? 0;
  const startedAt = ck?.execute.started_at ?? null;
  const completedAt = state.getGoal(goalId)?.completed_at ?? null;
  const halts = countHaltsFromProgressLog(harnessDir);
  const text = composeRetro(
    goalSpec,
    features,
    halts,
    iteration,
    elapsedSec,
    startedAt,
    completedAt,
    harnessDir
  );
  mkdirSync10(dirname11(path), { recursive: true });
  writeFileSync9(path, text, "utf-8");
  appendEvent7(harnessDir, {
    ts: nowIso12(options.now),
    type: "goal_retro_written",
    goal_id: goalId,
    feature_count: features.length,
    halt_count: halts.total
  });
  return {
    path,
    created: true,
    feature_count: features.length,
    halt_count: halts.total
  };
}
var init_goalRetro = __esm({
  "src/drive/goalRetro.ts"() {
    "use strict";
    init_state();
    init_checkpoint();
    init_goalStore();
  }
});

// src/drive/loop.ts
var loop_exports = {};
__export(loop_exports, {
  DEFAULT_MAX_RETRIES: () => DEFAULT_MAX_RETRIES,
  runDriveLoop: () => runDriveLoop,
  runDriveStep: () => runDriveStep
});
import { execFileSync } from "node:child_process";
import { existsSync as existsSync8, readFileSync as readFileSync20 } from "node:fs";
import { dirname as dirname12, join as join21 } from "node:path";
function nowIso13(now) {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function isPlainObject19(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function workingTreeDirty2(projectRoot) {
  try {
    const out = execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8"
    });
    if (out.trim().length === 0) {
      return false;
    }
    const lines = out.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const path = line.slice(3);
      if (path.startsWith(".harness/state.yaml") || path.startsWith(".harness/_workspace/") || path === "CHANGELOG.md") {
        continue;
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
function pickActiveFeature(ck, state) {
  for (const fid of ck.plan.scaffolded_features) {
    const feature = state.getFeature(fid);
    if (feature === null) {
      continue;
    }
    if (feature.status === "in_progress") {
      return { fid, status: "in_progress" };
    }
  }
  for (const fid of ck.plan.scaffolded_features) {
    const feature = state.getFeature(fid);
    if (feature === null) {
      return { fid, status: "planned" };
    }
    if (feature.status === "planned") {
      return { fid, status: "planned" };
    }
  }
  for (const fid of ck.plan.scaffolded_features) {
    const feature = state.getFeature(fid);
    if (feature !== null && feature.status === "blocked") {
      return { fid, status: "blocked" };
    }
  }
  return null;
}
function allFeaturesDone(ck, state) {
  if (ck.plan.scaffolded_features.length === 0) {
    return false;
  }
  for (const fid of ck.plan.scaffolded_features) {
    const feature = state.getFeature(fid);
    if (feature === null || feature.status !== "done") {
      return false;
    }
  }
  return true;
}
function loadSpecForPlanner(harnessDir) {
  const path = join21(harnessDir, "spec.yaml");
  if (!existsSync8(path)) {
    return null;
  }
  try {
    return (0, import_yaml16.parse)(readFileSync20(path, "utf-8"));
  } catch {
    return null;
  }
}
function chooseSuggestion(suggestions) {
  return suggestions.length === 0 ? null : suggestions[0] ?? null;
}
function bumpRetryCounter(ck, fid, gate, failed) {
  if (!isPlainObject19(ck.execute.retry_counts[fid])) {
    ck.execute.retry_counts[fid] = {};
  }
  const map = ck.execute.retry_counts[fid];
  if (!failed) {
    map[gate] = 0;
    return 0;
  }
  const next = (map[gate] ?? 0) + 1;
  map[gate] = next;
  return next;
}
function statusOf(feature) {
  return feature === null ? "planned" : feature.status;
}
function runDriveStep(harnessDir, options) {
  const now = options.now ? options.now() : /* @__PURE__ */ new Date();
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  let ck = loadCheckpoint(harnessDir);
  if (ck === null) {
    return {
      proceed: false,
      halt: emitHalt(harnessDir, "manual", 'no drive checkpoint \u2014 run `harness drive "<goal>"` first.')
    };
  }
  if (stopFileExists(harnessDir)) {
    return {
      proceed: false,
      halt: emitHalt(harnessDir, "stop_file", "STOP file present \u2014 drive halted.", {
        goal_id: ck.goal_id,
        iteration: ck.execute.iteration,
        now
      })
    };
  }
  if (ck.execute.iteration >= ck.execute.max_iterations) {
    return {
      proceed: false,
      halt: emitHalt(
        harnessDir,
        "iteration_cap",
        `iteration cap ${ck.execute.max_iterations} reached.`,
        { goal_id: ck.goal_id, iteration: ck.execute.iteration, now }
      )
    };
  }
  const startedAt = ck.execute.started_at;
  if (typeof startedAt === "string" && startedAt.length > 0) {
    const startMs = Date.parse(startedAt);
    if (!Number.isNaN(startMs)) {
      const elapsed = Math.floor((now.getTime() - startMs) / 1e3);
      if (elapsed >= ck.execute.max_seconds) {
        return {
          proceed: false,
          halt: emitHalt(
            harnessDir,
            "wall_clock",
            `wall-clock cap ${ck.execute.max_seconds}s reached (${elapsed}s elapsed).`,
            { goal_id: ck.goal_id, iteration: ck.execute.iteration, now }
          )
        };
      }
    }
  } else {
    ck.execute.started_at = nowIso13(now);
  }
  const stateGoalCheck = State.load(harnessDir);
  if (allFeaturesDone(ck, stateGoalCheck)) {
    if (ck.phase !== "done") {
      try {
        generateGoalRetro(harnessDir, ck.goal_id, { now });
      } catch {
      }
      ck.phase = "done";
      stateGoalCheck.setGoalStatus(ck.goal_id, "done");
      stateGoalCheck.save();
      saveCheckpoint(harnessDir, ck, now);
    }
    return { proceed: false, goal_done: true };
  }
  const active = pickActiveFeature(ck, stateGoalCheck);
  if (active === null) {
    return {
      proceed: false,
      halt: emitHalt(harnessDir, "manual", "no active feature in goal \u2014 please inspect spec.yaml.")
    };
  }
  const activeFeature = stateGoalCheck.getFeature(active.fid);
  if (statusOf(activeFeature) === "blocked") {
    return {
      proceed: false,
      halt: emitHalt(
        harnessDir,
        "feature_blocked",
        `${active.fid} is blocked \u2014 unblock then resume.`,
        { goal_id: ck.goal_id, feature_id: active.fid, iteration: ck.execute.iteration, now }
      )
    };
  }
  if (activeFeature !== null && countDeclaredEvidence3(activeFeature) >= 1) {
    const gate5 = activeFeature.gates["gate_5"];
    if (isPlainObject19(gate5) && gate5.last_result === "pass") {
      const projectRoot = dirname12(harnessDir);
      if (workingTreeDirty2(projectRoot)) {
        return {
          proceed: false,
          halt: emitHalt(
            harnessDir,
            "commit_boundary",
            `${active.fid} is ready to complete \u2014 review changes and \`git commit\`, then resume.`,
            {
              goal_id: ck.goal_id,
              feature_id: active.fid,
              iteration: ck.execute.iteration,
              now
            }
          )
        };
      }
    }
  }
  const spec = loadSpecForPlanner(harnessDir);
  const stateForPlanner = State.load(harnessDir);
  if (stateForPlanner.data.session.active_feature_id !== active.fid) {
    stateForPlanner.setActive(active.fid);
    stateForPlanner.save();
  }
  const suggestions = suggest(stateForPlanner.data, spec);
  const chosen = chooseSuggestion(suggestions);
  if (chosen === null) {
    return {
      proceed: false,
      halt: emitHalt(
        harnessDir,
        "manual",
        `intentPlanner returned no suggestion for ${active.fid} \u2014 inspect state.yaml.`,
        { goal_id: ck.goal_id, feature_id: active.fid, now }
      )
    };
  }
  const mapped = mapSuggestion(chosen);
  const executed = executeAction(harnessDir, mapped, options.executorHooks);
  if (mapped.kind === "run_gate" && executed.work !== void 0) {
    const failed = Array.isArray(executed.work.gates_failed) && executed.work.gates_failed.includes(mapped.gate);
    const count = bumpRetryCounter(ck, mapped.feature_id, mapped.gate, failed);
    if (count >= maxRetries) {
      ck.execute.iteration += 1;
      saveCheckpoint(harnessDir, ck, now);
      return {
        proceed: false,
        action: mapped,
        executor: executed,
        feature_id: mapped.feature_id,
        halt: emitHalt(
          harnessDir,
          "retry_threshold",
          `${mapped.gate} on ${mapped.feature_id} failed ${count} times in a row \u2014 yielding.`,
          {
            goal_id: ck.goal_id,
            feature_id: mapped.feature_id,
            gate: mapped.gate,
            iteration: ck.execute.iteration,
            now
          }
        )
      };
    }
  }
  ck.execute.iteration += 1;
  ck.execute.active_feature = active.fid;
  ck = recomputeElapsed(ck, now);
  saveCheckpoint(harnessDir, ck, now);
  const stateAfter = State.load(harnessDir);
  for (const fid of ck.plan.scaffolded_features) {
    const f = stateAfter.getFeature(fid);
    stateAfter.setGoalFeatureProgress(ck.goal_id, fid, statusOf(f));
  }
  if (ck.phase !== "executing") {
    ck.phase = "executing";
    stateAfter.setGoalStatus(ck.goal_id, "executing");
    saveCheckpoint(harnessDir, ck, now);
  }
  stateAfter.save();
  return {
    proceed: executed.proceed,
    action: mapped,
    executor: executed,
    feature_id: active.fid,
    halt: executed.halt ? emitHalt(harnessDir, executed.halt.reason, executed.halt.message, {
      goal_id: ck.goal_id,
      feature_id: active.fid,
      iteration: ck.execute.iteration,
      now
    }) : void 0
  };
}
function runDriveLoop(options) {
  const hardLimit = options.hardIterationLimit ?? Number.POSITIVE_INFINITY;
  let last = { proceed: true };
  let count = 0;
  while (last.proceed && count < hardLimit) {
    last = runDriveStep(options.harnessDir, options);
    count += 1;
    if (last.goal_done) {
      return last;
    }
  }
  return last;
}
function recomputeElapsed(ck, now) {
  if (typeof ck.execute.started_at !== "string") {
    return ck;
  }
  const startMs = Date.parse(ck.execute.started_at);
  if (Number.isNaN(startMs)) {
    return ck;
  }
  const elapsed = Math.max(0, Math.floor((now.getTime() - startMs) / 1e3));
  ck.execute.elapsed_sec = elapsed;
  return ck;
}
function countDeclaredEvidence3(feature) {
  if (!Array.isArray(feature.evidence)) {
    return 0;
  }
  let count = 0;
  for (const ev of feature.evidence) {
    if (!isPlainObject19(ev)) {
      continue;
    }
    const kind = ev.kind;
    if (typeof kind === "string" && (kind === "gate_run" || kind === "gate_auto_run")) {
      continue;
    }
    count += 1;
  }
  return count;
}
var import_yaml16, DEFAULT_MAX_RETRIES;
var init_loop = __esm({
  "src/drive/loop.ts"() {
    "use strict";
    import_yaml16 = __toESM(require_dist(), 1);
    init_state();
    init_intentPlanner();
    init_checkpoint();
    init_halt();
    init_executor();
    init_goalRetro();
    DEFAULT_MAX_RETRIES = 3;
  }
});

// src/cli/harness.ts
import { existsSync as existsSync9, statSync as statSync17 } from "node:fs";
import { join as join22, resolve as resolvePath7 } from "node:path";

// node_modules/commander/esm.mjs
var import_index = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  // deprecated old name
  Command,
  Argument,
  Option,
  Help
} = import_index.default;

// src/cli/harness.ts
init_designReview();
init_kickoff();
init_retro();

// src/ceremonies/inbox.ts
var import_yaml2 = __toESM(require_dist(), 1);
import { readFileSync as readFileSync3, readdirSync, statSync as statSync4 } from "node:fs";
import { join as join4, relative as relative4 } from "node:path";
var FILENAME_RE = /^(F-\d+)--([\w-]+)--([\w-]+)\.md$/;
var ANSWER_HEADER_RE = /^##\s+Answer\b/m;
var FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
function isPlainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseFrontmatter(text) {
  const match = FRONTMATTER_RE.exec(text);
  if (match === null) {
    return {};
  }
  try {
    const parsed = (0, import_yaml2.parse)(match[1]);
    return isPlainObject3(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function scanInbox(harnessDir, featureId2 = null) {
  const qDir = join4(harnessDir, "_workspace", "questions");
  let entries;
  try {
    if (!statSync4(qDir).isDirectory()) {
      return [];
    }
    entries = readdirSync(qDir).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    const fullPath = join4(qDir, name);
    try {
      if (!statSync4(fullPath).isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    const m = FILENAME_RE.exec(name);
    if (m === null) {
      continue;
    }
    const [, fid, fromAgent, toAgent] = m;
    if (featureId2 !== null && fid !== featureId2) {
      continue;
    }
    const body = readFileSync3(fullPath, "utf-8");
    const fm = parseFrontmatter(body);
    const hasAnswer = ANSWER_HEADER_RE.test(body);
    out.push({
      feature_id: fid,
      from_agent: fromAgent,
      to_agent: toAgent,
      path: relative4(harnessDir, fullPath),
      blocking: Boolean(fm["blocking"]),
      has_answer: hasAnswer
    });
  }
  return out;
}
function openQuestions(harnessDir, featureId2 = null) {
  return scanInbox(harnessDir, featureId2).filter((q) => !q.has_answer);
}

// src/cli/harness.ts
var import_yaml17 = __toESM(require_dist(), 1);
init_projectMode();
init_check();
import { readFileSync as readSpecFile, statSync as statSpecFile } from "node:fs";

// src/events.ts
function parseTs2(ts) {
  if (typeof ts !== "string" || ts.length === 0) {
    return null;
  }
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}
function isPlainObject6(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function filterEvents(events, options = {}) {
  const sinceDt = options.since ? parseTs2(options.since) : null;
  const out = [];
  for (const ev of events) {
    if (options.kind && ev["type"] !== options.kind) {
      continue;
    }
    if (options.feature) {
      let fid = ev["feature"] ?? ev["feature_id"];
      if ((fid === void 0 || fid === null) && isPlainObject6(ev["payload"])) {
        fid = ev["payload"]["feature"];
      }
      if (fid !== options.feature) {
        continue;
      }
    }
    if (sinceDt !== null) {
      const evDt = parseTs2(ev["ts"]);
      if (evDt === null || evDt.getTime() < sinceDt.getTime()) {
        continue;
      }
    }
    out.push(ev);
  }
  return out;
}
function formatHuman2(events) {
  if (events.length === 0) {
    return "(no matching events)\n";
  }
  const lines = [`\u{1F4DC} /harness:events (${events.length} events)`, ""];
  for (const ev of events) {
    const ts = typeof ev["ts"] === "string" ? ev["ts"] : "?";
    const typ = typeof ev["type"] === "string" ? ev["type"] : "?";
    const extras = [];
    for (const key of ["feature", "feature_id", "spec_hash", "phase", "reason"]) {
      if (key in ev) {
        let val = ev[key];
        if (key === "spec_hash" && typeof val === "string") {
          val = val.slice(0, 12);
        }
        extras.push(`${key}=${val}`);
      }
    }
    const extrasStr = extras.join(" \xB7 ");
    lines.push(`  ${ts}  ${typ}${extrasStr ? `  (${extrasStr})` : ""}`);
  }
  return `${lines.join("\n")}
`;
}

// src/core/eventLog.ts
import { appendFileSync as appendFileSync4, readdirSync as readdirSync3, readFileSync as readFileSync7, statSync as statSync8, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join8 } from "node:path";
var ROTATED_FILENAME_RE = /^events\.log\.(\d{6})$/;
var ROTATABLE_TS_RE = /^(\d{4})-(\d{2})/;
var UNPARSEABLE_TS_SENTINEL = "\uFFFF";
function readJsonLines(path) {
  let raw;
  try {
    raw = readFileSync7(path, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
  const out = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        out.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return out;
}
function rotatedPaths(harnessDir) {
  let entries;
  try {
    entries = readdirSync3(harnessDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
  const matched = [];
  for (const name of entries) {
    const m = ROTATED_FILENAME_RE.exec(name);
    if (!m) {
      continue;
    }
    const fullPath = join8(harnessDir, name);
    try {
      if (!statSync8(fullPath).isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    matched.push([m[1], fullPath]);
  }
  matched.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return matched.map(([, path]) => path);
}
function eventSortKey(ev) {
  const ts = ev.ts;
  if (typeof ts === "string" && ROTATABLE_TS_RE.test(ts)) {
    return [ts, 0];
  }
  return [UNPARSEABLE_TS_SENTINEL, 0];
}
function* readEvents2(harnessDir) {
  const buffer = [];
  for (const path of rotatedPaths(harnessDir)) {
    buffer.push(...readJsonLines(path));
  }
  buffer.push(...readJsonLines(join8(harnessDir, "events.log")));
  buffer.sort((a, b) => {
    const [ka, ta] = eventSortKey(a);
    const [kb, tb] = eventSortKey(b);
    if (ka < kb) {
      return -1;
    }
    if (ka > kb) {
      return 1;
    }
    return ta - tb;
  });
  yield* buffer;
}

// src/metrics.ts
var PERIOD_RE = /^\s*(\d+)\s*([smhdw])\s*$/i;
var PERIOD_UNIT_SEC = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800
};
function parsePeriod(text) {
  const match = PERIOD_RE.exec(text);
  if (match === null) {
    throw new Error(`invalid period: '${text}' (expected e.g. 7d, 24h, 30m)`);
  }
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  return n * PERIOD_UNIT_SEC[unit] * 1e3;
}
function isPlainObject7(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseTs3(ts) {
  if (typeof ts !== "string" || ts.length === 0) {
    return null;
  }
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}
function featureId(ev) {
  let fid = ev["feature"] ?? ev["feature_id"];
  if ((fid === void 0 || fid === null) && isPlainObject7(ev["payload"])) {
    fid = ev["payload"]["feature"];
  }
  return typeof fid === "string" ? fid : null;
}
function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
function round3(value) {
  return Math.round(value * 1e3) / 1e3;
}
function isoZ(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function aggregate(events, options = {}) {
  const report = {
    window: {
      start: options.windowStart ? isoZ(options.windowStart) : null,
      end: options.windowEnd ? isoZ(options.windowEnd) : null,
      period: options.periodLabel ?? null
    },
    total_events: 0,
    event_types: {},
    features: { activated: 0, done: 0, blocked: 0 },
    lead_time_sec: { count: 0, min: null, median: null, mean: null, max: null },
    gate_stats: {},
    drift_incidents: 0
  };
  const activatedLast = /* @__PURE__ */ new Map();
  const doneFirst = /* @__PURE__ */ new Map();
  for (const ev of events) {
    report.total_events += 1;
    const typ = typeof ev["type"] === "string" ? ev["type"] : "?";
    report.event_types[typ] = (report.event_types[typ] ?? 0) + 1;
    if (typ === "sync_failed") {
      report.drift_incidents += 1;
    } else if (typ === "feature_activated") {
      report.features.activated += 1;
      const fid = featureId(ev);
      const dt = parseTs3(ev["ts"]);
      if (fid !== null && dt !== null) {
        activatedLast.set(fid, dt);
      }
    } else if (typ === "feature_blocked") {
      report.features.blocked += 1;
    } else if (typ === "feature_done") {
      report.features.done += 1;
      const fid = featureId(ev);
      const dt = parseTs3(ev["ts"]);
      if (fid !== null && dt !== null && !doneFirst.has(fid)) {
        doneFirst.set(fid, dt);
      }
    } else if (typ === "gate_recorded" || typ === "gate_auto_run") {
      const gate = ev["gate"];
      if (typeof gate !== "string") {
        continue;
      }
      const result = ev["result"];
      const bucket = report.gate_stats[gate] ?? (report.gate_stats[gate] = {
        pass: 0,
        fail: 0,
        skipped: 0,
        other: 0,
        pass_rate: 0
      });
      if (result === "pass" || result === "fail" || result === "skipped") {
        bucket[result] += 1;
      } else {
        bucket.other += 1;
      }
    }
  }
  const deltas = [];
  for (const [fid, doneDt] of doneFirst.entries()) {
    const actDt = activatedLast.get(fid);
    if (actDt && doneDt.getTime() >= actDt.getTime()) {
      deltas.push((doneDt.getTime() - actDt.getTime()) / 1e3);
    }
  }
  if (deltas.length > 0) {
    report.lead_time_sec.count = deltas.length;
    report.lead_time_sec.min = round3(Math.min(...deltas));
    report.lead_time_sec.max = round3(Math.max(...deltas));
    report.lead_time_sec.median = round3(median(deltas));
    report.lead_time_sec.mean = round3(deltas.reduce((acc, d) => acc + d, 0) / deltas.length);
  }
  for (const bucket of Object.values(report.gate_stats)) {
    const denom = bucket.pass + bucket.fail;
    bucket.pass_rate = denom > 0 ? round3(bucket.pass / denom) : 0;
  }
  return report;
}
function compute(harnessDir, options = {}) {
  const allEvents = [...readEvents2(harnessDir)];
  let windowStart = null;
  let windowEnd = null;
  let periodLabel = null;
  if (options.since) {
    const dt = parseTs3(options.since);
    if (dt === null) {
      throw new Error(`invalid since timestamp: '${options.since}'`);
    }
    windowStart = dt;
  } else if (options.period) {
    const ms = parsePeriod(options.period);
    const base = options.now ?? /* @__PURE__ */ new Date();
    windowEnd = base;
    windowStart = new Date(base.getTime() - ms);
    periodLabel = options.period;
  }
  let filtered;
  if (windowStart !== null) {
    const startMs = windowStart.getTime();
    const endMs = windowEnd?.getTime() ?? Number.POSITIVE_INFINITY;
    filtered = allEvents.filter((ev) => {
      const dt = parseTs3(ev["ts"]);
      if (dt === null) {
        return false;
      }
      const t2 = dt.getTime();
      return t2 >= startMs && t2 <= endMs;
    });
  } else {
    filtered = allEvents;
  }
  return aggregate(filtered, { windowStart, windowEnd, periodLabel });
}
function fmtSec(value) {
  if (value === null) {
    return "\u2014";
  }
  if (value >= 86400) {
    return `${(value / 86400).toFixed(2)}d`;
  }
  if (value >= 3600) {
    return `${(value / 3600).toFixed(2)}h`;
  }
  if (value >= 60) {
    return `${(value / 60).toFixed(2)}m`;
  }
  return `${value.toFixed(1)}s`;
}
function pad(s, width) {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
function padLeft(s, width) {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}
function formatHuman3(report) {
  const lines = ["\u{1F4CA} /harness:metrics", ""];
  const win = report.window;
  if (win.period) {
    lines.push(`Window: last ${win.period} (${win.start} \u2192 now)`);
  } else if (win.start) {
    lines.push(`Window: since ${win.start}`);
  } else {
    lines.push("Window: all time");
  }
  lines.push("");
  lines.push(`Total events: ${report.total_events}`);
  if (Object.keys(report.event_types).length > 0) {
    lines.push("  by type:");
    for (const [t2, n] of Object.entries(report.event_types).sort()) {
      lines.push(`    ${pad(t2, 20)} ${n}`);
    }
  }
  lines.push("");
  const f = report.features;
  lines.push(`Features: ${f.done} done \xB7 ${f.activated} activated \xB7 ${f.blocked} blocked`);
  const lt = report.lead_time_sec;
  if (lt.count > 0) {
    lines.push(
      `Lead time (n=${lt.count}): min ${fmtSec(lt.min)} \xB7 median ${fmtSec(lt.median)} \xB7 mean ${fmtSec(lt.mean)} \xB7 max ${fmtSec(lt.max)}`
    );
  } else {
    lines.push("Lead time: (no completed feature cycles in window)");
  }
  lines.push("");
  if (Object.keys(report.gate_stats).length > 0) {
    lines.push("Gate stats:");
    lines.push(`  ${pad("gate", 8)} ${padLeft("pass", 5)} ${padLeft("fail", 5)} ${padLeft("skip", 5)}   rate`);
    for (const [gate, b] of Object.entries(report.gate_stats).sort()) {
      const rate = b.pass + b.fail > 0 ? `${(b.pass_rate * 100).toFixed(1)}%` : "\u2014";
      lines.push(
        `  ${pad(gate, 8)} ${padLeft(String(b.pass), 5)} ${padLeft(String(b.fail), 5)} ${padLeft(String(b.skipped), 5)}   ${rate}`
      );
    }
  } else {
    lines.push("Gate stats: (no gate events in window)");
  }
  lines.push("");
  return `${lines.join("\n").replace(/\s+$/, "")}
`;
}

// src/ui/dashboard.ts
var import_yaml5 = __toESM(require_dist(), 1);
init_gates();
init_kickoff();
import { readFileSync as readFileSync8, statSync as statSync9 } from "node:fs";
import { join as join9 } from "node:path";

// src/ui/dashboardConfig.ts
var DEFAULT_MAX_OTHER = 5;
var DEFAULT_MAX_PENDING = 5;
var DEFAULT_MAX_UNREGISTERED = 5;
function envInt(name, defaultValue) {
  const raw = process.env[name];
  if (raw === void 0) {
    return defaultValue;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return defaultValue;
  }
  return value;
}
function maxOtherList() {
  return envInt("HARNESS_DASHBOARD_MAX_OTHER", DEFAULT_MAX_OTHER);
}
function maxPendingList() {
  return envInt("HARNESS_DASHBOARD_MAX_PENDING", DEFAULT_MAX_PENDING);
}
function maxUnregisteredList() {
  return envInt("HARNESS_DASHBOARD_MAX_UNREGISTERED", DEFAULT_MAX_UNREGISTERED);
}

// src/ui/lang.ts
var SUPPORTED = /* @__PURE__ */ new Set(["en", "ko"]);
var KOREAN_HINTS = ["ko", "kor", "KR"];
function asObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
function resolveLang(spec = null) {
  const envValue = process.env["HARNESS_LANG"];
  if (envValue && SUPPORTED.has(envValue)) {
    return envValue;
  }
  const specObj = asObject(spec);
  if (specObj !== null) {
    const project = asObject(specObj["project"]);
    if (project !== null) {
      const specLang = project["language"];
      if (typeof specLang === "string" && SUPPORTED.has(specLang)) {
        return specLang;
      }
    }
  }
  for (const key of ["LC_ALL", "LANG"]) {
    const locale = process.env[key] ?? "";
    if (KOREAN_HINTS.some((hint) => locale.includes(hint))) {
      return "ko";
    }
    if (locale.length > 0 && locale.toLowerCase().includes("en")) {
      return "en";
    }
  }
  return "en";
}

// src/ui/messages.ts
var EN = {
  status: "status",
  passed: "passed",
  failed: "failed",
  evidence: "evidence: {n} entries",
  routed_agents: "routed agents",
  agent_chain: "agent chain",
  in_progress: "in progress",
  done: "done",
  planned: "planned",
  blocked: "blocked",
  archived: "archived",
  gate_pass: "gate {name}: pass",
  gate_fail: "gate {name}: fail",
  iron_law_block: "cannot complete yet \u2014 {declared}/{required} evidence entries declared. Add more with --evidence.",
  walking_skeleton: "walking skeleton",
  active_feature: 'working on: "{title}"',
  progress_line: "  progress: {passed}/{total} gates passed \xB7 {evidence} evidence entries",
  blocker_line: "  blocker: {note}",
  dashboard_title: "harness-boot",
  no_active: "no active feature.",
  all_done: "all features complete \u2014 {n} done.",
  next_actions: "next actions:",
  enter_hint: "Enter = {n} (recommended)",
  init_starting: "scaffolding .harness/ ...",
  init_done: "scaffolding complete.",
  in_progress_others: "in progress (others):",
  pending_label: "pending:",
  on_hold_label: "on hold:",
  next_candidates: "next candidates (spec-defined \xB7 not started, {n}):",
  more_after_truncate: "  \u2026 and {n} more (see spec.yaml)",
  no_features: "no features yet.",
  no_active_no_pending: "nothing in progress or pending.",
  recommended_marker: "(recommended)"
};
var KO = {
  status: "\uC0C1\uD0DC",
  passed: "\uD1B5\uACFC",
  failed: "\uC2E4\uD328",
  evidence: "\uADFC\uAC70: {n} \uAC1C",
  routed_agents: "\uB77C\uC6B0\uD305\uB41C \uD300",
  agent_chain: "\uC5D0\uC774\uC804\uD2B8 \uCCB4\uC778",
  in_progress: "\uC9C4\uD589 \uC911",
  done: "\uC644\uB8CC",
  planned: "\uC608\uC815",
  blocked: "\uCC28\uB2E8",
  archived: "\uBCF4\uAD00",
  gate_pass: "\uAC80\uC99D {name}: \uD1B5\uACFC",
  gate_fail: "\uAC80\uC99D {name}: \uC2E4\uD328",
  iron_law_block: "\uC544\uC9C1 \uC644\uB8CC\uD560 \uC218 \uC5C6\uC5B4\uC694 \u2014 \uADFC\uAC70\uAC00 {declared}/{required} \uAC1C\uC785\uB2C8\uB2E4. --evidence \uB85C \uB354 \uCD94\uAC00\uD558\uC138\uC694.",
  walking_skeleton: "\uAE30\uBCF8 \uACE8\uACA9",
  active_feature: '\uC791\uC5C5 \uC911: "{title}"',
  progress_line: "  \uC9C4\uD589: \uAC80\uC99D {passed}/{total} \uD1B5\uACFC \xB7 \uADFC\uAC70 {evidence} \uAC1C",
  blocker_line: "  \uCC28\uB2E8: {note}",
  dashboard_title: "harness-boot",
  no_active: "\uD604\uC7AC \uC791\uC5C5 \uC911\uC778 \uD53C\uCC98 \uC5C6\uC74C.",
  all_done: "\uBAA8\uB4E0 \uD53C\uCC98 \uC644\uB8CC \u2014 \uC644\uB8CC {n} \uAC1C.",
  next_actions: "\uB2E4\uC74C \uD560 \uC77C:",
  enter_hint: "Enter = {n} (\uCD94\uCC9C)",
  init_starting: ".harness/ \uACE8\uACA9 \uC0DD\uC131 \uC911 ...",
  init_done: "\uACE8\uACA9 \uC0DD\uC131 \uC644\uB8CC.",
  in_progress_others: "\uC9C4\uD589 \uC911 (\uB2E4\uB978):",
  pending_label: "\uB300\uAE30:",
  on_hold_label: "\uBCF4\uB958:",
  next_candidates: "\uB2E4\uC74C \uD6C4\uBCF4 (spec \uC815\uC758 \xB7 \uBBF8\uC2DC\uC791, {n} \uAC1C):",
  more_after_truncate: "  \u2026 \uC678 {n} \uAC1C (spec.yaml \uCC38\uC870)",
  no_features: "\uC544\uC9C1 \uD53C\uCC98\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  no_active_no_pending: "\uC9C4\uD589 \uC911 \xB7 \uB300\uAE30 \uD53C\uCC98 \uC5C6\uC74C.",
  recommended_marker: "(\uCD94\uCC9C)"
};
var CATALOGS = { en: EN, ko: KO };
var REQUIRED_KEYS = Object.keys(EN);
function t(key, lang = "en", fmt = {}) {
  let catalog = CATALOGS[lang] ?? EN;
  if (!(key in catalog)) {
    if (!(key in EN)) {
      throw new Error(`unknown message key: '${key}'`);
    }
    catalog = EN;
  }
  let template4 = catalog[key];
  if (Object.keys(fmt).length === 0) {
    return template4;
  }
  for (const [k, v] of Object.entries(fmt)) {
    template4 = template4.split(`{${k}}`).join(String(v));
  }
  return template4;
}

// src/ui/render.ts
var PARALLEL_TOKEN = " \u2225 ";
var SEQUENCE_TOKEN = " \u2192 ";
var COMMA_JOIN = ", ";
function renderAgentChain(agents, groups, options = {}) {
  const parallelToken = options.parallelToken ?? PARALLEL_TOKEN;
  const sequenceToken = options.sequenceToken ?? SEQUENCE_TOKEN;
  const commaJoin = options.commaJoin ?? COMMA_JOIN;
  if (groups.length === 0) {
    return agents.join(commaJoin);
  }
  const groupSets = groups.map((g) => new Set(g));
  const parts = [];
  let i = 0;
  while (i < agents.length) {
    const member = agents[i];
    const matched = groupSets.find((gs) => gs.has(member)) ?? null;
    if (matched === null) {
      parts.push(member);
      i++;
      continue;
    }
    const block2 = [];
    while (i < agents.length && matched.has(agents[i])) {
      block2.push(agents[i]);
      i++;
    }
    if (block2.length >= 2) {
      parts.push(`(${block2.join(parallelToken).trim()})`);
    } else {
      parts.push(block2[0]);
    }
  }
  return parts.join(sequenceToken).trim();
}

// src/ui/dashboard.ts
var DEFAULT_COVERAGE_THRESHOLD2 = 0.8;
var DEBT_ALERT_THRESHOLD = 5;
function isPlainObject8(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function asArray3(value) {
  return Array.isArray(value) ? value : [];
}
function isFile4(path) {
  try {
    return statSync9(path).isFile();
  } catch {
    return false;
  }
}
function loadCoverage(harnessDir, fid) {
  if (harnessDir === null) {
    return [null, []];
  }
  const fpPath = join9(harnessDir, "_workspace", "coverage", `${fid}.yaml`);
  if (!isFile4(fpPath)) {
    return [null, []];
  }
  let fp;
  try {
    fp = (0, import_yaml5.parse)(readFileSync8(fpPath, "utf-8"));
  } catch {
    return [null, []];
  }
  if (!isPlainObject8(fp)) {
    return [null, []];
  }
  const mismatches = asArray3(fp["mismatches"]);
  if (mismatches.length === 0) {
    return [1, []];
  }
  const ratios = [];
  const detailed = [];
  for (const m of mismatches) {
    if (!isPlainObject8(m)) {
      continue;
    }
    const desc = Number(m["description_value"] ?? 0);
    const ac = Number(m["ac_value"] ?? 0);
    if (Number.isNaN(desc) || Number.isNaN(ac) || desc <= 0) {
      continue;
    }
    ratios.push(ac / desc);
    detailed.push({ metric: typeof m["metric"] === "string" ? m["metric"] : "", ac, desc });
  }
  if (ratios.length === 0) {
    return [null, []];
  }
  const mean = ratios.reduce((acc, r) => acc + r, 0) / ratios.length;
  return [mean, detailed];
}
function formatCoverageLine(coverage, detailed) {
  const pct = Math.round(coverage * 100);
  const parts = detailed.map((d) => `${d.ac}/${d.desc} ${d.metric}`);
  const detail = parts.join(", ");
  return detail.length > 0 ? `  coverage: ${pct}% (${detail})` : `  coverage: ${pct}%`;
}
function featureTitle(fid, spec) {
  if (!isPlainObject8(spec)) {
    return fid;
  }
  for (const f of asArray3(spec["features"])) {
    if (isPlainObject8(f) && f["id"] === fid) {
      const title = f["name"] ?? f["title"];
      if (typeof title === "string" && title.trim().length > 0) {
        return title.trim();
      }
    }
  }
  return fid;
}
function countGatesPassed(gates) {
  let count = 0;
  for (const g of STANDARD_GATES) {
    const entry = gates[g];
    if (isPlainObject8(entry) && entry["last_result"] === "pass") {
      count++;
    }
  }
  return count;
}
function latestBlockerNote(feature) {
  const evidence = asArray3(feature["evidence"]);
  for (let i = evidence.length - 1; i >= 0; i--) {
    const ev = evidence[i];
    if (!isPlainObject8(ev)) {
      continue;
    }
    if (ev["kind"] === "blocker") {
      const summary = ev["summary"];
      return typeof summary === "string" && summary.trim().length > 0 ? summary.trim() : null;
    }
    return null;
  }
  return null;
}
function resolveAgentChain(fid, spec) {
  if (!isPlainObject8(spec)) {
    return { agents: [], groups: [] };
  }
  const features = asArray3(spec["features"]);
  const feature = features.find((f) => isPlainObject8(f) && f["id"] === fid);
  if (!isPlainObject8(feature)) {
    return { agents: [], groups: [] };
  }
  try {
    const shapes = detectShapes(feature, spec);
    if (shapes.length === 0) {
      return { agents: [], groups: [] };
    }
    const audio = hasAudioFlag(feature);
    return {
      agents: agentsForShapes(shapes, audio),
      groups: parallelGroupsForShapes(shapes, audio)
    };
  } catch {
    return { agents: [], groups: [] };
  }
}
function renderActiveBlock(feature, spec, lang, harnessDir) {
  const fid = typeof feature["id"] === "string" ? feature["id"] : "?";
  const title = featureTitle(fid, spec);
  const gates = isPlainObject8(feature["gates"]) ? feature["gates"] : {};
  const passed = countGatesPassed(gates);
  const evidenceCount = asArray3(feature["evidence"]).length;
  const lines = [t("active_feature", lang, { title })];
  lines.push(
    t("progress_line", lang, {
      passed,
      total: STANDARD_GATES.length,
      evidence: evidenceCount
    })
  );
  const [coverage, detailed] = loadCoverage(harnessDir, fid);
  if (coverage !== null && coverage < 1) {
    lines.push(formatCoverageLine(coverage, detailed));
  }
  const blocker = latestBlockerNote(feature);
  if (blocker !== null) {
    lines.push(t("blocker_line", lang, { note: blocker }));
  }
  const { agents, groups } = resolveAgentChain(fid, spec);
  if (agents.length > 0) {
    lines.push(`  ${t("agent_chain", lang)}: ${renderAgentChain(agents, groups)}`);
  }
  return lines;
}
function renderCoverageDebt(features, harnessDir, threshold, _lang) {
  if (harnessDir === null) {
    return [];
  }
  const withMismatches = [];
  const belowThreshold = [];
  for (const f of features) {
    if (!isPlainObject8(f)) {
      continue;
    }
    const fid = f["id"];
    if (typeof fid !== "string") {
      continue;
    }
    const [coverage] = loadCoverage(harnessDir, fid);
    if (coverage === null || coverage >= 1) {
      continue;
    }
    withMismatches.push(fid);
    if (coverage < threshold) {
      belowThreshold.push(fid);
    }
  }
  if (withMismatches.length === 0) {
    return [];
  }
  const block2 = [];
  if (belowThreshold.length > DEBT_ALERT_THRESHOLD) {
    block2.push("\u26A0 Coverage debt high \u2014 review carry-forward before next feature");
  }
  block2.push(
    `Coverage debt: ${withMismatches.length} features with mismatches (${belowThreshold.length} below threshold ${threshold.toFixed(2)})`
  );
  return block2;
}
function renderOtherInProgress(features, activeId, spec, lang) {
  const others = [];
  for (const f of features) {
    if (isPlainObject8(f) && f["status"] === "in_progress" && f["id"] !== activeId) {
      others.push(f);
    }
  }
  if (others.length === 0) {
    return [];
  }
  const lines = [t("in_progress_others", lang)];
  for (const f of others.slice(0, maxOtherList())) {
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    lines.push(`  "${featureTitle(fid, spec)}"`);
  }
  return lines;
}
function renderPending(features, spec, lang) {
  const pending = [];
  for (const f of features) {
    if (isPlainObject8(f) && f["status"] === "planned") {
      pending.push(f);
    }
  }
  if (pending.length === 0) {
    return [];
  }
  const titles = pending.slice(0, maxPendingList()).map((f) => {
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    return `"${featureTitle(fid, spec)}"`;
  });
  return [`${t("pending_label", lang)} ${titles.join(" \xB7 ")}`];
}
function renderUnregistered(stateFeatures, spec, lang) {
  if (!isPlainObject8(spec)) {
    return { lines: [], total: 0 };
  }
  const specFeatures = asArray3(spec["features"]);
  if (specFeatures.length === 0) {
    return { lines: [], total: 0 };
  }
  const registered = /* @__PURE__ */ new Set();
  for (const f of stateFeatures) {
    if (isPlainObject8(f) && typeof f["id"] === "string") {
      registered.add(f["id"]);
    }
  }
  const candidates = [];
  for (const f of specFeatures) {
    if (!isPlainObject8(f)) {
      continue;
    }
    const fid = f["id"];
    if (typeof fid !== "string" || fid.length === 0) {
      continue;
    }
    if (registered.has(fid)) {
      continue;
    }
    if (f["status"] === "archived") {
      continue;
    }
    if (f["superseded_by"]) {
      continue;
    }
    if (f["archived_at"]) {
      continue;
    }
    candidates.push(f);
  }
  if (candidates.length === 0) {
    return { lines: [], total: 0 };
  }
  const max = maxUnregisteredList();
  const titles = candidates.slice(0, max).map((f) => {
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    return `"${featureTitle(fid, spec)}"`;
  });
  const header = t("next_candidates", lang, { n: candidates.length });
  const lines = [header, `  ${titles.join(" \xB7 ")}`];
  if (candidates.length > max) {
    lines.push(t("more_after_truncate", lang, { n: candidates.length - max }));
  }
  return { lines, total: candidates.length };
}
function renderBlocked(features, activeId, spec, lang) {
  const blocked = [];
  for (const f of features) {
    if (isPlainObject8(f) && f["status"] === "blocked" && f["id"] !== activeId) {
      blocked.push(f);
    }
  }
  if (blocked.length === 0) {
    return [];
  }
  const titles = blocked.slice(0, maxOtherList()).map((f) => {
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    return `"${featureTitle(fid, spec)}"`;
  });
  return [`${t("on_hold_label", lang)} ${titles.join(" \xB7 ")}`];
}
function renderSuggestions(suggestions, lang) {
  if (suggestions.length === 0) {
    return [];
  }
  const lines = [t("next_actions", lang)];
  const markerText = t("recommended_marker", lang);
  suggestions.forEach((s, i) => {
    const idx = i + 1;
    const marker = idx === 1 ? ` ${markerText}` : "";
    lines.push(`  (${idx}) ${s.label}${marker}`);
  });
  lines.push("");
  lines.push(t("enter_hint", lang, { n: 1 }));
  return lines;
}
function render(stateData, spec, suggestions, options = {}) {
  const lang = options.lang ?? resolveLang(spec);
  const harnessDir = options.harnessDir ?? null;
  const sections = [];
  sections.push([`\u{1F4CA} ${t("dashboard_title", lang)}`]);
  const features = isPlainObject8(stateData) ? asArray3(stateData["features"]) : [];
  const session = isPlainObject8(stateData) && isPlainObject8(stateData["session"]) ? stateData["session"] : null;
  const activeId = session !== null && typeof session["active_feature_id"] === "string" ? session["active_feature_id"] : null;
  const byId = /* @__PURE__ */ new Map();
  for (const f of features) {
    if (isPlainObject8(f) && typeof f["id"] === "string") {
      byId.set(f["id"], f);
    }
  }
  if (activeId !== null && byId.has(activeId)) {
    sections.push(renderActiveBlock(byId.get(activeId), spec, lang, harnessDir));
  }
  const otherBlock = renderOtherInProgress(features, activeId, spec, lang);
  if (otherBlock.length > 0) {
    sections.push(otherBlock);
  }
  const blockedBlock = renderBlocked(features, activeId, spec, lang);
  if (blockedBlock.length > 0) {
    sections.push(blockedBlock);
  }
  const pendingBlock = renderPending(features, spec, lang);
  if (pendingBlock.length > 0) {
    sections.push(pendingBlock);
  }
  const { lines: unregisteredBlock, total: unregisteredCount } = renderUnregistered(features, spec, lang);
  if (unregisteredBlock.length > 0) {
    sections.push(unregisteredBlock);
  }
  const debtBlock = renderCoverageDebt(features, harnessDir, DEFAULT_COVERAGE_THRESHOLD2, lang);
  if (debtBlock.length > 0) {
    sections.push(debtBlock);
  }
  if (byId.size === 0 && features.length === 0 && unregisteredCount === 0) {
    sections.push([t("no_features", lang)]);
  } else if ((activeId === null || !byId.has(activeId)) && otherBlock.length === 0 && blockedBlock.length === 0 && pendingBlock.length === 0 && unregisteredBlock.length === 0) {
    let doneCount = 0;
    for (const f of features) {
      if (isPlainObject8(f) && f["status"] === "done") {
        doneCount++;
      }
    }
    if (doneCount > 0) {
      sections.push([t("all_done", lang, { n: doneCount })]);
    } else {
      sections.push([t("no_active_no_pending", lang)]);
    }
  }
  const suggestionBlock = renderSuggestions(suggestions, lang);
  if (suggestionBlock.length > 0) {
    sections.push(suggestionBlock);
  }
  const joined = sections.map((b) => b.join("\n")).join("\n\n");
  return `${joined.replace(/\s+$/, "")}
`;
}

// src/cli/harness.ts
init_intentPlanner();
init_validate();
init_state();

// src/status.ts
var import_yaml7 = __toESM(require_dist(), 1);
init_state();
import { readFileSync as readFileSync10, statSync as statSync11 } from "node:fs";
import { join as join11 } from "node:path";
function isPlainObject10(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function loadHarnessYaml(harnessDir) {
  const path = join11(harnessDir, "harness.yaml");
  try {
    if (!statSync11(path).isFile()) {
      return {};
    }
  } catch {
    return {};
  }
  const raw = readFileSync10(path, "utf-8");
  const parsed = (0, import_yaml7.parse)(raw);
  return isPlainObject10(parsed) ? parsed : {};
}
function tailEvents(harnessDir, n = 1) {
  const path = join11(harnessDir, "events.log");
  try {
    if (!statSync11(path).isFile()) {
      return [];
    }
  } catch {
    return [];
  }
  const raw = readFileSync10(path, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const tail2 = lines.slice(-n);
  const out = [];
  for (const line of tail2) {
    try {
      const parsed = JSON.parse(line);
      if (isPlainObject10(parsed)) {
        out.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return out;
}
function buildReport(harnessDir, options = {}) {
  const featureFilter = options.featureFilter ?? null;
  const state = State.load(harnessDir);
  const harnessYaml = loadHarnessYaml(harnessDir);
  const generation = isPlainObject10(harnessYaml["generation"]) ? harnessYaml["generation"] : {};
  const driftStatus = typeof generation["drift_status"] === "string" ? generation["drift_status"] : "unknown";
  const recentEvents = tailEvents(harnessDir, 5);
  let lastSync = null;
  for (let i = recentEvents.length - 1; i >= 0; i--) {
    const ev = recentEvents[i];
    if (ev["type"] === "sync_completed") {
      const ts = typeof ev["ts"] === "string" ? ev["ts"] : null;
      const specHash = typeof ev["spec_hash"] === "string" ? ev["spec_hash"].slice(0, 12) : "";
      const pluginVersion2 = typeof ev["plugin_version"] === "string" ? ev["plugin_version"] : null;
      lastSync = { ts, spec_hash: specHash, plugin_version: pluginVersion2 };
      break;
    }
  }
  const counts = state.featureCounts();
  const featuresSummary = [];
  for (const f of state.data.features) {
    if (!isPlainObject10(f)) {
      continue;
    }
    const fid = typeof f["id"] === "string" ? f["id"] : "?";
    if (featureFilter !== null && fid !== featureFilter) {
      continue;
    }
    const gates = isPlainObject10(f["gates"]) ? f["gates"] : {};
    const passed = [];
    const failed = [];
    for (const [g, v] of Object.entries(gates)) {
      if (!isPlainObject10(v)) {
        continue;
      }
      const result = v["last_result"];
      if (result === "pass") {
        passed.push(g);
      } else if (result === "fail") {
        failed.push(g);
      }
    }
    featuresSummary.push({
      id: fid,
      status: typeof f["status"] === "string" ? f["status"] : "planned",
      started_at: typeof f["started_at"] === "string" ? f["started_at"] : null,
      completed_at: typeof f["completed_at"] === "string" ? f["completed_at"] : null,
      gates_passed: passed,
      gates_failed: failed,
      evidence_count: Array.isArray(f["evidence"]) ? f["evidence"].length : 0
    });
  }
  const activeFid = state.data.session.active_feature_id;
  const activeFeature = typeof activeFid === "string" ? featuresSummary.find((f) => f.id === activeFid) ?? null : null;
  return {
    session: { ...state.data.session },
    counts,
    drift_status: driftStatus,
    last_sync: lastSync,
    features_summary: featuresSummary,
    active_feature: activeFeature
  };
}
function rstrip4(s) {
  return s.replace(/\s+$/, "");
}
function pad2(s, width) {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
function formatHuman4(report) {
  const lines = ["\u{1F4CB} /harness:status", ""];
  const s = report.session;
  lines.push("Session");
  lines.push(`  started_at         ${s.started_at ?? "\u2014"}`);
  lines.push(`  last_command       ${s.last_command || "\u2014"}`);
  lines.push(`  last_gate_passed   ${s.last_gate_passed ?? "\u2014"}`);
  lines.push(`  active_feature_id  ${s.active_feature_id ?? "\u2014"}`);
  lines.push("");
  const c = report.counts;
  const total = Object.values(c).reduce((acc, n) => acc + n, 0);
  lines.push(`Features (${total})`);
  for (const [st, n] of Object.entries(c)) {
    if (n > 0) {
      lines.push(`  ${pad2(st, 12)} ${n}`);
    }
  }
  lines.push("");
  lines.push(`Drift status: ${report.drift_status}`);
  lines.push("");
  if (report.last_sync !== null) {
    const ls = report.last_sync;
    lines.push(
      `Last sync: ${ls.ts ?? ""} \xB7 spec_hash=${ls.spec_hash} \xB7 plugin=${ls.plugin_version ?? ""}`
    );
    lines.push("");
  }
  if (report.active_feature !== null) {
    const af = report.active_feature;
    lines.push(`Active feature: ${af.id} [${af.status}]`);
    if (af.gates_passed.length > 0) {
      lines.push(`  gates passed: ${af.gates_passed.join(", ")}`);
    }
    if (af.gates_failed.length > 0) {
      lines.push(`  gates failed: ${af.gates_failed.join(", ")}`);
    }
    lines.push(`  evidence: ${af.evidence_count} entries`);
    lines.push("");
  }
  return `${rstrip4(lines.join("\n"))}
`;
}

// src/cli/harness.ts
var import_yaml18 = __toESM(require_dist(), 1);
init_sync();
init_work();
import { readFileSync as readFileSync21 } from "node:fs";
function printHuman(text) {
  process.stdout.write(text);
}
function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}
`);
}
function printError(message) {
  process.stderr.write(`${message}
`);
}
function isDirectory4(path) {
  try {
    return statSync17(path).isDirectory();
  } catch {
    return false;
  }
}
function resolveHarnessDir(opt) {
  return resolvePath7(opt ?? join22(process.cwd(), ".harness"));
}
function workResultToJson(r) {
  return {
    feature_id: r.feature_id,
    action: r.action,
    current_status: r.current_status,
    gates_passed: r.gates_passed,
    gates_failed: r.gates_failed,
    evidence_count: r.evidence_count,
    message: r.message,
    routed_agents: r.routed_agents,
    parallel_groups: r.parallel_groups
  };
}
function formatWorkHuman(r) {
  const lines = [];
  lines.push(`\u{1F6E0}  /harness:work \xB7 ${r.action} \xB7 ${r.feature_id}`);
  lines.push("");
  lines.push(`status: ${r.current_status}`);
  if (r.gates_passed.length > 0) {
    lines.push(`passed: ${r.gates_passed.join(", ")}`);
  }
  if (r.gates_failed.length > 0) {
    lines.push(`failed: ${r.gates_failed.join(", ")}`);
  }
  lines.push(`evidence: ${r.evidence_count} entries`);
  if (r.message) {
    lines.push("");
    lines.push(r.message);
  }
  if (r.routed_agents.length > 0) {
    lines.push("");
    lines.push(`routed agents: ${r.routed_agents.join(", ")}`);
  }
  return `${lines.join("\n")}
`;
}
function emitWork(result, json) {
  if (json) {
    printJson(workResultToJson(result));
  } else {
    printHuman(formatWorkHuman(result));
  }
}
function buildProgram() {
  const program2 = new Command();
  program2.name("harness").description("Multi-agent development harness \u2014 TS CLI for Claude Code plugin").version("0.14.1");
  const work = program2.command("work").description("feature lifecycle (activate / gate / evidence / complete / dashboard)").argument("[feature]", "feature id (e.g. F-001) \u2014 omitted invokes the dashboard").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--current", "show the active feature (read-only)").option("--gate <values...>", "record a gate result manually \u2014 `--gate <name> <result>` (e.g. `--gate gate_0 pass`)").option("--run-gate <name>", "auto-run a gate via the gate runner and record the result").option("--project-root <dir>", "cwd for --run-gate (default: harness-dir parent)").option("--override-command <cmd>", "override gate command (space-separated)").option("--timeout <sec>", "timeout for --run-gate", "300").option("--note <text>", "note for --gate", "").option("--evidence <summary>", "add an evidence row with this summary").option("--kind <kind>", "kind for --evidence or --block", "generic").option("--block <reason>", "mark feature as blocked with this reason").option("--complete", "transition to done (Iron Law applies)").option("--hotfix-reason <reason>", "override Iron Law evidence floor with audited reason").option("--archive", "transition done \u2192 archived").option("--superseded-by <fid>", "feature id replacing this archived feature").option("--reason <text>", "archive reason").option("--deactivate", "clear session.active_feature_id only").option("--remove <fid>", "remove a non-done feature from state.yaml").option("--kickoff", "force-regenerate the kickoff template (idempotency override)").option("--design-review", "force-regenerate the design-review template").option("--retro", "force-regenerate the retro template").option("--no-fog", "skip the F-037 fog-clear auto-wire on activate").option("--json", "emit JSON instead of human-readable text").action((feature, options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    const json = Boolean(options["json"]);
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const removeFid = options["remove"];
    if (removeFid) {
      const r2 = removeFeature(harnessDir, removeFid);
      emitWork(r2, json);
      return;
    }
    if (options["deactivate"]) {
      const r2 = deactivate(harnessDir);
      emitWork(r2, json);
      return;
    }
    if (options["current"]) {
      const r2 = current(harnessDir);
      if (r2 === null) {
        if (json) {
          printJson({ active: null });
        } else {
          printHuman("no active feature\n");
        }
        return;
      }
      emitWork(r2, json);
      return;
    }
    if (!feature) {
      const state = State.load(harnessDir);
      const specPath = join22(harnessDir, "spec.yaml");
      let spec = null;
      try {
        if (existsSync9(specPath)) {
          spec = (0, import_yaml18.parse)(readFileSync21(specPath, "utf-8"));
        }
      } catch {
        spec = null;
      }
      const suggestions = suggest(state.data, spec);
      const out = render(state.data, spec, suggestions, {
        lang: resolveLang(spec),
        harnessDir
      });
      if (json) {
        printJson({
          state: state.data,
          spec,
          suggestions,
          counts: state.featureCounts(),
          active_feature_id: state.data.session.active_feature_id
        });
      } else {
        printHuman(out);
      }
      return;
    }
    const fid = feature;
    function loadSpecOrNull() {
      const specPath = join22(harnessDir, "spec.yaml");
      try {
        if (statSpecFile(specPath).isFile()) {
          return (0, import_yaml17.parse)(readSpecFile(specPath, "utf-8"));
        }
      } catch {
        return null;
      }
      return null;
    }
    function findFeatureInSpec(spec, id) {
      if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
        return null;
      }
      const features = spec["features"];
      if (!Array.isArray(features)) {
        return null;
      }
      for (const f of features) {
        if (f !== null && typeof f === "object" && !Array.isArray(f) && f["id"] === id) {
          return f;
        }
      }
      return null;
    }
    if (options["kickoff"]) {
      const spec = loadSpecOrNull();
      const featureObj = findFeatureInSpec(spec, fid);
      if (featureObj === null) {
        printError(`error: feature ${fid} not in spec.yaml`);
        process.exit(3);
      }
      const shapes = detectShapes(featureObj, spec);
      if (shapes.length === 0) {
        printError(`error: no shapes detected for ${fid}`);
        process.exit(3);
      }
      let styleBlock = "";
      try {
        styleBlock = renderStyleBlock(harnessDir, featureObj);
      } catch {
        styleBlock = "";
      }
      const path = generateKickoff(harnessDir, fid, shapes, {
        hasAudio: hasAudioFlag(featureObj),
        force: true,
        mode: resolveMode(spec),
        styleBlock
      });
      if (json) {
        printJson({ path, shapes, agents: agentsForShapes(shapes, hasAudioFlag(featureObj)) });
      } else {
        printHuman(`${path}
`);
      }
      return;
    }
    if (options["designReview"]) {
      const spec = loadSpecOrNull();
      const featureObj = findFeatureInSpec(spec, fid);
      if (featureObj === null) {
        printError(`error: feature ${fid} not in spec.yaml`);
        process.exit(3);
      }
      const path = generateDesignReview(harnessDir, fid, {
        hasAudio: hasAudioFlag(featureObj)
      });
      if (json) {
        printJson({ path });
      } else {
        printHuman(`${path}
`);
      }
      return;
    }
    if (options["retro"]) {
      const spec = loadSpecOrNull();
      const path = generateRetro(harnessDir, fid, {
        force: true,
        mode: resolveMode(spec)
      });
      if (json) {
        printJson({ path });
      } else {
        printHuman(`${path}
`);
      }
      return;
    }
    if (options["runGate"]) {
      const gateName = options["runGate"];
      const overrideCmd = typeof options["overrideCommand"] === "string" ? options["overrideCommand"].split(/\s+/).filter((x) => x.length > 0) : null;
      const projectRoot = typeof options["projectRoot"] === "string" ? options["projectRoot"] : void 0;
      const r2 = runAndRecordGate(harnessDir, fid, gateName, {
        overrideCommand: overrideCmd,
        projectRoot,
        timeoutSec: Number(options["timeout"] ?? 300)
      });
      emitWork(r2, json);
      process.exit(r2.gates_failed.includes(gateName) ? 7 : 0);
    }
    if (options["gate"]) {
      const gateArgs = options["gate"];
      if (!Array.isArray(gateArgs) || gateArgs.length !== 2) {
        printError("error: --gate takes two values: <name> <result>");
        process.exit(3);
      }
      const [name, result] = gateArgs;
      const r2 = recordGate(harnessDir, fid, name, result, {
        note: options["note"] ?? ""
      });
      emitWork(r2, json);
      return;
    }
    if (typeof options["evidence"] === "string") {
      const r2 = addEvidence(
        harnessDir,
        fid,
        options["kind"] ?? "generic",
        options["evidence"]
      );
      emitWork(r2, json);
      return;
    }
    if (typeof options["block"] === "string") {
      const r2 = block(harnessDir, fid, options["block"], {
        kind: options["kind"] ?? "blocker"
      });
      emitWork(r2, json);
      return;
    }
    if (options["complete"]) {
      const r2 = complete(harnessDir, fid, {
        hotfixReason: typeof options["hotfixReason"] === "string" ? options["hotfixReason"] : null
      });
      emitWork(r2, json);
      return;
    }
    if (options["archive"]) {
      const r2 = archive(harnessDir, fid, {
        supersededBy: typeof options["supersededBy"] === "string" ? options["supersededBy"] : null,
        reason: typeof options["reason"] === "string" ? options["reason"] : null
      });
      emitWork(r2, json);
      return;
    }
    const r = activate(harnessDir, fid);
    emitWork(r, json);
  });
  void work;
  program2.command("sync").description("orchestrate Phase-0 sync (validate \u2192 expand \u2192 hash \u2192 render \u2192 events)").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--dry-run", "compute outputs but do not touch disk").option("--force", "ignore edit-wins and overwrite domain.md / architecture.yaml").option("--soft", "F-076 fail-open mode \u2014 never exits non-zero").option("--skip-validation", "skip JSONSchema check").option("--schema <path>", "path to spec.schema.json override").option("--timestamp <iso>", "override UTC timestamp (tests)").option("--json", "emit JSON summary").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    const json = Boolean(options["json"]);
    const soft = Boolean(options["soft"]);
    if (!isDirectory4(harnessDir)) {
      if (soft) {
        printError(`sync (initial): skip \u2014 harness dir ${harnessDir} not found`);
        process.exit(0);
      }
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    if (soft) {
      const r = tryInitialSync(harnessDir);
      const label = r.ok && !r.skipped ? "ok" : r.skipped ? "skip" : "fail";
      printHuman(`sync (initial): ${label} \u2014 ${r.reason}
`);
      process.exit(0);
    }
    try {
      const summary = run(harnessDir, {
        force: Boolean(options["force"]),
        dryRun: Boolean(options["dryRun"]),
        skipValidation: Boolean(options["skipValidation"]),
        schemaPath: typeof options["schema"] === "string" ? options["schema"] : null,
        timestamp: typeof options["timestamp"] === "string" ? options["timestamp"] : void 0
      });
      if (json) {
        printJson(summary);
      } else {
        printHuman(`spec_hash     ${summary.spec_hash}
`);
        printHuman(`merkle_root   ${summary.merkle_root}
`);
        printHuman(`include_count ${summary.include_count}
`);
        printHuman(`drift_status  ${summary.drift_status}
`);
        if (summary.domain_skipped) {
          printHuman("SKIP domain.md (edit-wins detected)\n");
        }
        if (summary.arch_skipped) {
          printHuman("SKIP architecture.yaml (edit-wins detected)\n");
        }
        if (summary.dry_run) {
          printHuman("(dry-run \u2014 no files written)\n");
        }
      }
    } catch (err) {
      if (err instanceof SpecValidationError) {
        printError(
          `schema error at ${err.path.length > 0 ? err.path.join(".") : "(root)"}: ${err.message}`
        );
        if (err.reason) {
          printError(`  validator: ${err.reason}`);
        }
        process.exit(5);
      }
      printError(`sync error: ${err.message}`);
      process.exit(3);
    }
  });
  program2.command("check").description("drift detection (read-only / CQS \u2014 never modifies any file)").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--project-root <dir>", "project root override (default: harness-dir parent)").option("--json", "emit JSON drift report").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    const projectRoot = typeof options["projectRoot"] === "string" ? options["projectRoot"] : null;
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const report = runCheck(harnessDir, projectRoot);
    if (options["json"]) {
      printJson({
        clean: report.findings.length === 0,
        checked: report.checked,
        findings: report.findings
      });
    } else {
      printHuman(formatHuman(report));
    }
    process.exit(report.findings.length === 0 ? 0 : 6);
  });
  program2.command("status").description("read-only state summary").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--feature <fid>", "restrict summary to a single feature id").option("--json", "emit JSON report").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const report = buildReport(harnessDir, {
      featureFilter: typeof options["feature"] === "string" ? options["feature"] : null
    });
    if (options["json"]) {
      printJson({
        session: report.session,
        counts: report.counts,
        drift_status: report.drift_status,
        last_sync: report.last_sync,
        features: report.features_summary,
        active_feature: report.active_feature
      });
    } else {
      printHuman(formatHuman4(report));
    }
  });
  program2.command("events").description("list events.log entries (read-only)").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--kind <type>", "filter by event.type").option("--feature <fid>", "filter by feature id").option("--since <iso>", "drop events older than this ISO 8601 timestamp").option("--all", "show every entry (default caps at 50 most recent)").option("--limit <n>", "override the default 50 cap", "50").option("--json", "emit JSON array").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const all = [...readEvents2(harnessDir)];
    let filtered = filterEvents(all, {
      kind: options["kind"] ?? null,
      feature: options["feature"] ?? null,
      since: options["since"] ?? null
    });
    if (!options["all"]) {
      const limit = Number(options["limit"] ?? 50);
      filtered = filtered.slice(-limit);
    }
    if (options["json"]) {
      printJson(filtered);
    } else {
      printHuman(formatHuman2(filtered));
    }
  });
  program2.command("metrics").description("aggregate events.log into throughput / lead time / gate stats").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--period <p>", "window like 7d, 24h, 30m").option("--since <iso>", "override window with explicit ISO 8601 start").option("--json", "emit JSON report").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const report = compute(harnessDir, {
      period: options["period"] ?? null,
      since: options["since"] ?? null
    });
    if (options["json"]) {
      printJson(report);
    } else {
      printHuman(formatHuman3(report));
    }
  });
  program2.command("inbox").description("list open Q&A questions under .harness/_workspace/questions/").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--feature <fid>", "filter to one feature id").option("--all", "include answered questions").option("--json", "emit JSON array").action((options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    const featureId2 = options["feature"] ?? null;
    const items = options["all"] ? scanInbox(harnessDir, featureId2) : openQuestions(harnessDir, featureId2);
    if (options["json"]) {
      printJson(items);
    } else if (items.length === 0) {
      printHuman(options["all"] ? "(no questions)\n" : "(no open questions)\n");
    } else {
      for (const q of items) {
        const flag = q.blocking ? "\u{1F512}" : "  ";
        const status = q.has_answer ? "\u2705" : "\u2753";
        printHuman(`${status} ${flag} ${q.feature_id} \xB7 ${q.from_agent} \u2192 ${q.to_agent}  ${q.path}
`);
      }
    }
  });
  program2.command("drive").description("autonomous loop driver \u2014 natural-language goal \u2192 Phase A plan \u2192 Phase B execute \u2192 Phase C retro").argument("[target]", "goal id (G-NNN), feature id (F-NNN), or free-text natural-language goal").option("--harness-dir <dir>", "path to .harness directory", "./.harness").option("--status", "render the progress dashboard for one (or all) goal(s) \u2014 read-only").option("--all", "with --status: render every goal in the spec").option("--json", "emit JSON output (status / dry-run / resume \u2014 machine consumable)").option("--watch", "with --status: re-render every <interval> seconds").option("--interval <sec>", "with --status --watch: refresh interval (default 2s)", "2").option("--resume", "continue Phase A or Phase B from the persisted checkpoint").option("--plan-only", "run Phase A advances; halt before Phase B execute loop").option("--auto-approve-brief", "skip the brief.md approval halt (#1 part 1)").option("--auto-approve-all", "skip every plan-phase halt (brief + plan)").option("--max-iterations <n>", "override Phase B iteration cap (default 50)").option("--max-hours <n>", "override Phase B wall-clock cap (default 2h)").option("--max-retries <n>", "override consecutive-fail cap before halt #3 (default 3)").option("--hard-step-limit <n>", "hard ceiling on steps per drive invocation (default 100)").option("--dry-run", "print the next action without executing it").option("--abort [gid]", "clear the active drive checkpoint (active goal by default)").action((target, options) => {
    const harnessDir = resolveHarnessDir(options["harnessDir"]);
    if (!isDirectory4(harnessDir)) {
      printError(`error: ${harnessDir} not found`);
      process.exit(2);
    }
    const isStatus = Boolean(options["status"]) || Boolean(options["watch"]) || Boolean(options["all"]) || // status is also the default when no argument and no Phase-A/B flag is supplied
    target === void 0 && !options["resume"] && !options["planOnly"] && !options["dryRun"] && !options["abort"];
    const explicitGoal = typeof target === "string" && /^G-\d+$/i.test(target) ? target : null;
    const explicitFeature = typeof target === "string" && /^F-\d+$/i.test(target) ? target : null;
    void explicitFeature;
    const json = Boolean(options["json"]);
    const approvals = {
      autoApproveBrief: Boolean(options["autoApproveBrief"]),
      autoApproveAll: Boolean(options["autoApproveAll"])
    };
    if (isStatus) {
      void Promise.resolve().then(() => (init_statusCommand(), statusCommand_exports)).then(
        ({ runDriveStatus: runDriveStatus2 }) => runDriveStatus2({
          harnessDir,
          goalId: explicitGoal,
          all: Boolean(options["all"]),
          json,
          watch: Boolean(options["watch"]),
          intervalSec: Number(options["interval"] ?? 2)
        })
      ).then((code) => {
        if (typeof code === "number" && code !== 0) {
          process.exit(code);
        }
      }).catch((err) => {
        printError(`drive: ${err.message}`);
        process.exit(2);
      });
      return;
    }
    if (options["abort"] !== void 0) {
      void Promise.resolve().then(() => (init_checkpoint(), checkpoint_exports)).then(({ clearCheckpoint: clearCheckpoint2, loadCheckpoint: loadCheckpoint2 }) => {
        const ck = loadCheckpoint2(harnessDir);
        const cleared = clearCheckpoint2(harnessDir);
        if (cleared) {
          const goalId = ck?.goal_id ?? "(unknown)";
          if (json) {
            printJson({ aborted: true, goal_id: goalId });
          } else {
            printHuman(`drive: aborted ${goalId}; checkpoint cleared.
`);
          }
        } else {
          if (json) {
            printJson({ aborted: false, message: "no active checkpoint" });
          } else {
            printHuman("drive: no active drive checkpoint to abort.\n");
          }
        }
      }).catch((err) => {
        printError(`drive: ${err.message}`);
        process.exit(2);
      });
      return;
    }
    const isFreeText = typeof target === "string" && !explicitGoal && !explicitFeature;
    if (isFreeText) {
      void Promise.resolve().then(() => (init_planPhase(), planPhase_exports)).then(({ startPhaseA: startPhaseA2 }) => {
        const r = startPhaseA2({ harnessDir, title: target, approvals });
        if (json) {
          printJson({
            goal_id: r.goalId,
            brief_path: r.briefPath,
            halt: { reason: r.halt.reason, message: r.halt.message }
          });
        } else {
          printHuman(
            `drive: goal ${r.goalId} created. researcher should write ${r.briefPath}.
${r.halt.message}
`
          );
        }
      }).catch((err) => {
        printError(`drive: ${err.message}`);
        process.exit(2);
      });
      return;
    }
    const planOnly = Boolean(options["planOnly"]);
    const dryRun = Boolean(options["dryRun"]);
    void Promise.resolve().then(() => (init_checkpoint(), checkpoint_exports)).then(async ({ loadCheckpoint: loadCheckpoint2, saveCheckpoint: saveCheckpoint2 }) => {
      const ck = loadCheckpoint2(harnessDir);
      if (ck === null) {
        printError(
          'drive: no active checkpoint. Start with `harness drive "<natural-language goal>"`.'
        );
        process.exit(3);
        return;
      }
      if (options["maxIterations"] !== void 0) {
        ck.execute.max_iterations = Number(options["maxIterations"]);
      }
      if (options["maxHours"] !== void 0) {
        ck.execute.max_seconds = Math.round(Number(options["maxHours"]) * 3600);
      }
      saveCheckpoint2(harnessDir, ck);
      if (ck.phase === "planning") {
        const { advancePhaseA: advancePhaseA2 } = await Promise.resolve().then(() => (init_planPhase(), planPhase_exports));
        const r2 = advancePhaseA2(harnessDir, approvals);
        if (r2.kind === "halt") {
          if (json) {
            printJson({
              phase: "planning",
              halt: { reason: r2.halt.reason, message: r2.halt.message },
              brief_path: r2.briefPath,
              plan_path: r2.planPath
            });
          } else {
            printHuman(`drive: ${r2.halt.message}
`);
          }
          return;
        }
        if (planOnly) {
          if (json) {
            printJson({ phase: "scaffolded", goal_id: r2.goalId, feature_ids: r2.featureIds });
          } else {
            printHuman(
              `drive: Phase A done. Goal ${r2.goalId} scaffolded with ${r2.featureIds.length} features. (--plan-only requested \u2014 stopping before Phase B execute loop.)
`
            );
          }
          return;
        }
      }
      const { runDriveLoop: runDriveLoop2, runDriveStep: runDriveStep2 } = await Promise.resolve().then(() => (init_loop(), loop_exports));
      if (dryRun) {
        const step = runDriveStep2(harnessDir, {
          harnessDir,
          maxRetries: options["maxRetries"] !== void 0 ? Number(options["maxRetries"]) : void 0
        });
        const summary2 = {
          dry_run: true,
          proceed: step.proceed,
          feature_id: step.feature_id ?? null
        };
        if (step.action !== void 0 && step.action !== null) {
          summary2.action = step.action.kind;
          if ("feature_id" in step.action) {
            summary2.action_feature = step.action.feature_id;
          }
          if ("gate" in step.action) {
            summary2.action_gate = step.action.gate;
          }
        }
        if (step.halt !== void 0) {
          summary2.halt = { reason: step.halt.reason, message: step.halt.message };
        }
        if (json) {
          printJson(summary2);
        } else {
          if (step.halt !== void 0) {
            printHuman(`drive [dry-run]: would halt \u2014 ${step.halt.message}
`);
          } else if (step.action !== null && step.action !== void 0) {
            printHuman(`drive [dry-run]: next action = ${step.action.kind}
`);
          } else {
            printHuman("drive [dry-run]: no action selected\n");
          }
        }
        return;
      }
      const r = runDriveLoop2({
        harnessDir,
        maxRetries: options["maxRetries"] !== void 0 ? Number(options["maxRetries"]) : void 0,
        hardIterationLimit: options["hardStepLimit"] !== void 0 ? Number(options["hardStepLimit"]) : 100
      });
      const summary = {
        proceed: r.proceed,
        goal_done: r.goal_done ?? false,
        feature_id: r.feature_id ?? null
      };
      if (r.halt !== void 0) {
        summary.halt = { reason: r.halt.reason, message: r.halt.message };
      }
      if (json) {
        printJson(summary);
      } else if (r.goal_done) {
        printHuman("drive: goal complete \u2014 Phase C retro generated.\n");
      } else if (r.halt !== void 0) {
        printHuman(`drive: ${r.halt.message}
`);
      } else {
        printHuman("drive: step limit reached for this invocation; resume to continue.\n");
      }
    }).catch((err) => {
      printError(`drive: ${err.message}`);
      process.exit(2);
    });
  });
  program2.command("validate").description("validate a spec.yaml against the JSONSchema").argument("<spec-path>", "path to spec.yaml").option("--schema <path>", "override schema location").option("--json", "emit JSON result").action((specPath, options) => {
    try {
      const data = loadSpec(specPath);
      validate(
        data,
        typeof options["schema"] === "string" ? options["schema"] : null
      );
      if (options["json"]) {
        printJson({ ok: true });
      } else {
        printHuman(`valid \u2014 ${specPath}
`);
      }
    } catch (err) {
      if (err instanceof SpecValidationError) {
        if (options["json"]) {
          printJson({ ok: false, path: err.path, message: err.message, reason: err.reason });
        } else {
          printError(`invalid: ${err.message}`);
          if (err.reason) {
            printError(`  reason: ${err.reason}`);
          }
        }
        process.exit(5);
      }
      printError(`error: ${err.message}`);
      process.exit(2);
    }
  });
  return program2;
}
function main(argv = process.argv) {
  const program2 = buildProgram();
  program2.parse([...argv]);
}
export {
  main
};
