import { SegmentMark } from '../src/index'
import testData from './assets/test.json'
const segment = new SegmentMark()

segment.beginDraw(testData)

window.addEventListener('load', () => {
  document.body.style.height = window.innerHeight + 'px'
})
