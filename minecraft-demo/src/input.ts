/* 输入抽象：键盘状态 + 鼠标拖拽/点击区分 + 滚轮 */
export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  run: boolean
  jump: boolean // 上升沿（每帧消费）
  dx: number // 拖拽横向增量（每帧清零）
  dy: number // 拖拽纵向增量
  leftClick: boolean // 非拖拽左键点击（上升沿）
  rightClick: boolean // 右键点击
  scroll: number // 滚轮增量
  pick: number | null // 数字键 1-5（方块选择）
  dragging: boolean
}

export function createInput(el: HTMLElement): { state: InputState; update: () => void; dispose: () => void } {
  const s: InputState = {
    forward: false, backward: false, left: false, right: false,
    run: false, jump: false, dx: 0, dy: 0, leftClick: false, rightClick: false,
    scroll: 0, pick: null, dragging: false,
  }
  const keys = new Set<string>()
  let mDown = { x: 0, y: 0, t: 0, left: false }
  let dragMoved = false

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const k = e.code
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(k)) e.preventDefault()
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(k)) {
      s.pick = Number(k.slice(-1))
    }
    if (k === 'Space' && !keys.has(k)) s.jump = true
    keys.add(k)
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      mDown = { x: e.clientX, y: e.clientY, t: performance.now(), left: true }
      dragMoved = false
    } else if (e.button === 2) {
      s.rightClick = true
    }
  }
  const onMouseMove = (e: MouseEvent) => {
    if (mDown.left) {
      const dx = e.clientX - mDown.x
      const dy = e.clientY - mDown.y
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragMoved = true
      s.dx += dx
      s.dy += dy
      mDown.x = e.clientX
      mDown.y = e.clientY
    }
  }
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0 && mDown.left) {
      if (!dragMoved && performance.now() - mDown.t < 400) s.leftClick = true
      mDown.left = false
    }
  }
  const onWheel = (e: WheelEvent) => {
    s.scroll += e.deltaY > 0 ? 1 : -1
  }
  const onCtx = (e: Event) => e.preventDefault()

  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('keyup', onKeyUp)
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mousemove', onMouseMove)
  el.addEventListener('mouseup', onMouseUp)
  el.addEventListener('wheel', onWheel, { passive: true })
  el.addEventListener('contextmenu', onCtx)
  el.tabIndex = 0
  el.focus()

  const update = () => {
    s.forward = keys.has('KeyW')
    s.backward = keys.has('KeyS')
    s.left = keys.has('KeyA')
    s.right = keys.has('KeyD')
    s.run = keys.has('ShiftLeft') || keys.has('ShiftRight')
    s.dragging = mDown.left
  }

  const dispose = () => {
    el.removeEventListener('keydown', onKeyDown)
    el.removeEventListener('keyup', onKeyUp)
    el.removeEventListener('mousedown', onMouseDown)
    el.removeEventListener('mousemove', onMouseMove)
    el.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('contextmenu', onCtx)
  }

  return { state: s, update, dispose }
}

/** 每帧消费一次性事件（jump/click/pick/scroll），返回状态 */
export function consume(input: InputState): InputState {
  input.jump = false
  input.leftClick = false
  input.rightClick = false
  input.scroll = 0
  input.pick = null
  input.dx = 0
  input.dy = 0
  return input
}
