<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
// legacy-сборка pdf.js работает и на старых iPad; современная требует свежий Safari.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ blob: Blob; screen: number }>()
const emit = defineEmits<{ count: [n: number] }>()
const box = ref<HTMLDivElement>()
let task: pdfjs.PDFDocumentLoadingTask | null = null
let doc: pdfjs.PDFDocumentProxy | null = null
let seq = 0
// Готовые страницы: следующая рисуется заранее, поэтому листание мгновенное.
const rendered = new Map<number, Promise<HTMLCanvasElement>>()

function draw(page: number): Promise<HTMLCanvasElement> {
  let c = rendered.get(page)
  if (!c) {
    c = (async () => {
      const p = await doc!.getPage(page + 1)
      const base = p.getViewport({ scale: 1 })
      const scale = Math.min(box.value!.clientWidth / base.width, box.value!.clientHeight / base.height)
      const dpr = devicePixelRatio || 1
      const viewport = p.getViewport({ scale: scale * dpr })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`
      await p.render({ canvas, viewport }).promise
      return canvas
    })()
    rendered.set(page, c)
  }
  return c
}

async function show() {
  if (!doc || !box.value) return
  const ticket = ++seq
  const page = Math.max(0, Math.min(props.screen, doc.numPages - 1))
  const canvas = await draw(page)
  if (ticket !== seq) return
  box.value.replaceChildren(canvas)
  if (page + 1 < doc.numPages) draw(page + 1)
  for (const k of rendered.keys()) if (k < page - 1 || k > page + 1) rendered.delete(k)
}

function onResize() {
  rendered.clear()
  show()
}

onMounted(async () => {
  task = pdfjs.getDocument({ data: new Uint8Array(await props.blob.arrayBuffer()) })
  doc = await task.promise
  emit('count', doc.numPages)
  show()
  addEventListener('resize', onResize)
})
watch(() => props.screen, show)
onBeforeUnmount(() => {
  removeEventListener('resize', onResize)
  task?.destroy()
})
</script>

<template>
  <div ref="box" class="flex h-full w-full items-center justify-center bg-white" />
</template>
