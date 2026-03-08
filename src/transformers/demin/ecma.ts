import { buildRegExp, choiceOf, endOfString, startOfString, zeroOrMore } from "ts-regex-builder"

// https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#prod-IdentifierName
// https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-identifier-names
const UnicodeIDStart = /\p{ID_Start}/u
const UnicodeIDContinue = /\p{ID_Continue}/u
const IdentifierStartChar = choiceOf(UnicodeIDStart, "$", "_")
const IdentifierPartChar = choiceOf(UnicodeIDContinue, "$")
// IdentifierStart and IdentifierPart also accept `\ UnicodeEscapeSequence` sequences,
// but we don't care about that since validating UnicodeEscapeSequence would be beyond the scope of regex.
const IdentifierStart = IdentifierStartChar
const IdentifierPart = IdentifierPartChar
const IdentifierName = [IdentifierStart, zeroOrMore(IdentifierPart)]

const identifierNameRegex = buildRegExp([
  startOfString,
  ...IdentifierName,
  endOfString,
], { unicode: true })

export const asValidIdentifierName = (name: string) => identifierNameRegex.exec(name)?.[0]
