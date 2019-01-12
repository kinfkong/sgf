const fs = require('fs')

const Peekable = require('./peekable')
const {tokenizeIter, tokenizeBufferIter} = require('./tokenize')
const {unescapeString} = require('./helper')

function _parseTokens(peekableTokens, getId, dictionary, onProgress) {
    let anchor = null
    let node, property

    while (!peekableTokens.peek().done) {
        let {type, value, row, col} = peekableTokens.peek().value

        if (type === 'parenthesis' && value === '(') break
        if (type === 'parenthesis' && value === ')') return anchor

        if (type === 'semicolon') {
            let lastNode = node

            node = {
                id: getId(),
                data: {},
                parentId: lastNode == null ? null : lastNode.id,
                children: []
            }

            if (dictionary != null) dictionary[node.id] = node

            if (lastNode != null) lastNode.children.push(node)
            else anchor = node
        } else if (type === 'prop_ident') {
            if (node != null) {
                let identifier = value === value.toUpperCase() ? value
                    : value.split('').filter(x => x.toUpperCase() === x).join('')

                if (identifier !== '') {
                    if (!(identifier in node.data)) node.data[identifier] = []
                    property = node.data[identifier]
                } else {
                    property = null
                }
            }
        } else if (type === 'c_value_type') {
            if (property != null) {
                property.push(unescapeString(value.slice(1, -1)))
            }
        } else {
            throw new Error(`Unexpected token type '${type}' at ${row + 1}:${col + 1}`)
        }

        peekableTokens.next()
    }

    if (node == null) {
        anchor = node = {
            id: null,
            data: {},
            parentId: null,
            children: []
        }
    }

    while (!peekableTokens.peek().done) {
        let {type, value, progress} = peekableTokens.peek().value

        if (type === 'parenthesis' && value === '(') {
            peekableTokens.next()

            let child = _parseTokens(peekableTokens, getId, dictionary, onProgress)

            if (child != null) {
                child.parentId = node.id
                node.children.push(child)
            }
        } else if (type === 'parenthesis' && value === ')') {
            onProgress({progress})
            break
        }

        peekableTokens.next()
    }

    return anchor
}

exports.parseTokens = function(tokens, {
    getId = null,
    dictionary = null,
    onProgress = () => {}
} = {}) {
    if (getId == null) {
        let id = 0
        getId = () => id++
    }

    let node = _parseTokens(new Peekable(tokens), getId, dictionary, onProgress)
    return node.children
}

exports.parse = function(contents, options = {}) {
    return exports.parseTokens(tokenizeIter(contents), options)
}

exports.parseBuffer = function(buffer, options = {}) {
    return exports.parseTokens(tokenizeBufferIter(buffer, {encoding: options.encoding}), options)
}

exports.parseFile = function(filename, options = {}) {
    return exports.parseBuffer(fs.readFileSync(filename), options)
}
