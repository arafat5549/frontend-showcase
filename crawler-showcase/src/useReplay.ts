/* 重演播放器核心逻辑（React hook）
 * 可变状态放 playRef，避免闭包陈旧；setState 仅驱动渲染。
 * token 代次：跳过/重播时 +1，作废还在运行的播放循环（防竞态重复渲染）。
 */
import { useEffect, useRef, useState } from 'react'

export interface Item {
  title: string
  type: string
  pub_time: string
  region: string
  buyer: string
  url: string
}

export interface Evt {
  t: number
  type: string
  msg: string
  data?: { item?: Item }
}

export interface Meta {
  source: string
  list_url: string
  run_time: string
  fetched: number
  new: number
  total: number
  total_count?: number
  elapsed: number
}

const BASE_MS: Record<string, number> = {
  request: 650,
  parse: 450,
  item: 170,
  dedupe: 650,
  export: 900,
  done: 350,
  request_failed: 650,
}

interface PlayState {
  idx: number
  paused: boolean
  running: boolean
  finished: boolean
  token: number
  speed: number
  limit: string // 'all' | '10' | '5'
}

const INIT_PLAY: PlayState = {
  idx: 0,
  paused: false,
  running: false,
  finished: false,
  token: 0,
  speed: 1,
  limit: 'all',
}

export function useReplay() {
  const play = useRef<PlayState>({ ...INIT_PLAY })
  const eventsRef = useRef<Evt[]>([])
  const metaRef = useRef<Meta | null>(null)

  const [log, setLog] = useState<Evt[]>([])
  const [rows, setRows] = useState<Item[]>([])
  const [head, setHead] = useState('ready')
  const [cur, setCur] = useState(0)
  const [total, setTotal] = useState(0)
  const [finished, setFinished] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [limit, setLimitState] = useState('all')
  const [meta, setMetaState] = useState<Meta | null>(null)
  const [err, setErr] = useState('')
  const startedRef = useRef(false) // 数据加载后自动播放，只启动一次

  /** 按当前条数裁剪后的事件流 */
  const limited = (): Evt[] => {
    const all = eventsRef.current
    const lim = play.current.limit
    if (lim === 'all') return all
    const n = Number(lim)
    const out: Evt[] = []
    let cnt = 0
    for (const e of all) {
      if (e.type === 'item') {
        cnt += 1
        if (cnt > n) continue
      }
      out.push(e)
    }
    return out
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const step = 50
      const t0 = Date.now()
      const tick = () => {
        if (play.current.paused) {
          setTimeout(tick, step)
          return
        }
        if (Date.now() - t0 >= ms) {
          resolve()
          return
        }
        setTimeout(tick, step)
      }
      setTimeout(tick, step)
    })

  const applyEvent = (e: Evt) => {
    setLog((l) => [...l, e])
    if (e.type === 'item' && e.data?.item) {
      setRows((r) => [...r, e.data!.item!])
    }
    switch (e.type) {
      case 'request':
        setHead('请求中…')
        break
      case 'parse':
        setHead('解析中…')
        break
      case 'dedupe':
        setHead('去重中…')
        break
      case 'export':
        setHead('生成报表…')
        break
      case 'done':
        setHead('完成')
        break
    }
  }

  const finish = () => {
    play.current.running = false
    play.current.finished = true
    setPlaying(false)
    setFinished(true)
    setHead('完成')
  }

  const playLoop = async (token: number) => {
    const st = play.current
    const list = limited()
    while (st.idx < list.length && st.token === token) {
      if (st.paused) {
        await sleep(100)
        continue
      }
      const e = list[st.idx]
      st.idx += 1
      setCur(st.idx)
      setTotal(list.length)
      applyEvent(e)
      await sleep((BASE_MS[e.type] ?? 500) / st.speed)
    }
    if (st.token !== token) return // 已被跳过/重播取代
    finish()
  }

  const startPlay = () => {
    const st = play.current
    if (st.finished || st.running) return
    st.running = true
    st.paused = false
    setPlaying(true)
    const token = ++st.token
    void playLoop(token)
  }

  const toggle = () => {
    const st = play.current
    if (st.finished) return
    if (st.running) {
      st.paused = true
      st.running = false
      setPlaying(false)
    } else {
      startPlay()
    }
  }

  const replay = () => {
    const st = play.current
    st.token += 1 // 作废旧循环
    st.running = false
    st.paused = false
    st.finished = false
    st.idx = 0
    setLog([])
    setRows([])
    setCur(0)
    setHead('ready')
    setFinished(false)
    const list = limited()
    setTotal(list.length)
    startPlay()
  }

  const skip = () => {
    const st = play.current
    st.token += 1
    st.running = false
    st.paused = false
    const list = limited()
    const newLog: Evt[] = []
    const newRows: Item[] = []
    while (st.idx < list.length) {
      const e = list[st.idx]
      st.idx += 1
      newLog.push(e)
      if (e.type === 'item' && e.data?.item) newRows.push(e.data.item)
    }
    setLog(newLog)
    setRows(newRows)
    setCur(st.idx)
    setTotal(list.length)
    finish()
  }

  const setLimit = (v: string) => {
    const st = play.current
    if (st.limit === v) return
    st.limit = v
    setLimitState(v)
    if (st.idx === 0 && !st.finished) {
      // 未开播：直接换量
      setTotal(limited().length)
    } else {
      // 播放中/已完成：按新量重播
      replay()
    }
  }

  const setSpeed = (v: number) => {
    play.current.speed = v
    setSpeedState(v)
  }

  useEffect(() => {
    fetch('events.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json() as Promise<{ meta: Meta; events: Evt[] }>
      })
      .then((data) => {
        eventsRef.current = data.events ?? []
        metaRef.current = data.meta ?? null
        setMetaState(data.meta ?? null)
        setTotal(limited().length)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          skip()
        } else if (!startedRef.current) {
          // 默认直接播放
          startedRef.current = true
          startPlay()
        }
      })
      .catch((e: Error) => {
        setErr(e.message)
        setHead('加载失败')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    err,
    log,
    rows,
    head,
    cur,
    total,
    finished,
    playing,
    speed,
    limit,
    meta,
    toggle,
    replay,
    skip,
    setLimit,
    setSpeed,
  }
}
