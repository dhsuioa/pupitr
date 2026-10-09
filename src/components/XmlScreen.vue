<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { sliceScreens } from '../lib/stage'

const props = defineProps<{ xml: string; screen: number; zoom: number }>()
const emit = defineEmits<{ layout: [screens: number[], systemOfMeasure: number[]] }>()
const box = ref<HTMLDivElement>()
const sheet = ref<HTMLDivElement>()
const tops = ref<number[]>([0]) // верх каждого экрана, px
// ponytail: unitInPixels из VexFlowMusicSheetDrawer OSMD 2.2; сверить при смене версии
const UNIT = 10
let osmd: OpenSheetMusicDisplay | null = null

function layout() {
  const systems = osmd!.GraphicSheet.MusicPages.flatMap((p) => p.MusicSystems)
  const px = systems.map((s) => {
    const b = s.PositionAndShape
    return {
      top: (b.AbsolutePosition.y + b.BorderMarginTop) * UNIT * props.zoom,
      bottom: (b.AbsolutePosition.y + b.BorderMarginBottom) * UNIT * props.zoom,
    }
  })
  if (px.length) px[0].top = 0 // заголовок пьесы — часть первого экрана
  const screens = sliceScreens(px, box.value!.clientHeight)
  tops.value = screens.map((k) => px[k]?.top ?? 0)
  // Такт внутри мультипаузы может не иметь своей графики — берём строку предыдущего.
  let last = 0
  const systemOfMeasure = osmd!.GraphicSheet.MeasureList.map((row) => {
    const sys = row?.find((m) => m?.ParentMusicSystem)?.ParentMusicSystem
    if (sys) last = systems.indexOf(sys)
    return last
  })
  emit('layout', screens, systemOfMeasure)
}

function render() {
  osmd!.zoom = props.zoom
  osmd!.render()
  layout()
}

onMounted(async () => {
  osmd = new OpenSheetMusicDisplay(sheet.value!, {
    autoResize: false,
    backend: 'svg',
    drawTitle: true,
    drawSubtitle: false,
    drawComposer: false,
    drawCredits: false,
    drawPartNames: false,
  })
  await osmd.load(props.xml)
  render()
  addEventListener('resize', render)
})
onBeforeUnmount(() => removeEventListener('resize', render))
watch(() => props.zoom, render)
</script>

<template>
  <div ref="box" class="h-full w-full overflow-hidden bg-white">
    <div
      ref="sheet"
      :style="{ transform: `translateY(-${tops[Math.max(0, Math.min(screen, tops.length - 1))]}px)` }"
    />
  </div>
</template>
