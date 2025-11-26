const warnedNodes = new WeakSet<object>()

type DomNode = HTMLElement | SVGElement

const isElementNode = (node: unknown): node is DomNode => {
  if (!node || typeof node !== 'object') return false
  const maybeNode = node as { nodeType?: number; nodeName?: string }
  return maybeNode.nodeType === 1 && typeof maybeNode.nodeName === 'string'
}

export function isDOM(node: unknown): node is DomNode {
  return isElementNode(node)
}

export function getDOM(node: unknown): DomNode | null {
  if (!node) return null
  if (isElementNode(node)) {
    return node
  }

  if (typeof node === 'object') {
    const maybeNative = (node as { nativeElement?: unknown }).nativeElement
    if (isElementNode(maybeNative)) {
      return maybeNative
    }

    const maybeCurrent = (node as { current?: unknown }).current
    if (isElementNode(maybeCurrent)) {
      return maybeCurrent
    }
  }

  return null
}

const logMissingDomNode = (target: object) => {
  if (import.meta.env.PROD || warnedNodes.has(target)) {
    return
  }

  warnedNodes.add(target)
  const constructorName = (target as { constructor?: { name?: string } }).constructor?.name
  console.warn(
    `[strict-dom-node] 未能解析 DOM 节点，` +
      `请为 ${constructorName ?? 'AnonymousComponent'} 提供 DOM ref`
  )
}

export default function strictFindDOMNode(node: unknown): DomNode | null {
  const domNode = getDOM(node)
  if (domNode) {
    return domNode
  }

  if (node && typeof node === 'object') {
    logMissingDomNode(node as object)
  }

  return null
}
