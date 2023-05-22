import './assets/index.less';
import { THandledSegmentation, TImageCategorysData, TImageData } from './types/Segment';
import { checkMobile, loadImage, splitSegmentation } from './utils/utils';
import Konva from 'konva';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';

export class SegmentMark {
  $container: HTMLDivElement;
  $cutPictureCanvasContainer: HTMLDivElement;
  canvasContext: CanvasRenderingContext2D;
  imgSrc: string;
  imageData: TImageData;
  konvaLayer: Layer;
  konvaStage: Stage;

  constructor($container = document.querySelector('#segment-mark-container')) {
    if (!$container) {
      throw 'Segment container not found.';
    }
    this.$container = $container as HTMLDivElement;
    this.$cutPictureCanvasContainer = this.$container.querySelector(
      '#segment-cut-picture-canvas-container'
    );
    this.konvaStage = new Konva.Stage({
      container: this.$cutPictureCanvasContainer
    });
    this.konvaLayer = new Konva.Layer({
      draggable: true
    });
    this.konvaStage.add(this.konvaLayer);
    if (checkMobile()) {
      this._addMobileScaleEvent();
    } else {
      this._addPcScaleEvent();
    }
  }

  async beginDraw(imageData: TImageData) {
    this.imageData = JSON.parse(JSON.stringify(imageData));
    this._handleSegmentation();
    const $img = await this._loadImage(imageData.url);
    this.konvaStage.clear();
    this.konvaStage.width(window.innerWidth);
    this.konvaStage.height(window.innerHeight);
    const backgroundImage = new Konva.Image({
      image: $img,
      width: $img.width,
      height: $img.height
    });
    this.konvaLayer.add(backgroundImage);
    this._drawImagePolygon();
  }

  _drawImagePolygon() {
    this._foreachSegmentation((handledSeg, points, { fillColor }) => {
      const group = new Konva.Group({});

      const stroke = new Konva.Line({
        points,
        stroke: 'rgba(255, 255, 255, 0.7)',
        strokeWidth: 1,
        strokeEnabled: false,
        closed: true,
        lineCap: 'round',
        dash: [5, 5]
      });

      const fillPolygon = new Konva.Line({
        points,
        fill: fillColor + 'B2',
        closed: true
      });

      group.add(fillPolygon);
      group.add(stroke);

      const anim = new Konva.Animation((frame) => {
        const offset = frame.time / 50; // The offset of the ant line can be adjusted according to needs
        stroke.dashOffset(offset);
      }, this.konvaLayer);

      const handleTap = () => {
        handledSeg.isChecked = !handledSeg.isChecked;
        stroke.strokeEnabled(handledSeg.isChecked);
        if (handledSeg.isChecked) {
          anim.start();
        } else {
          anim.stop();
        }
      };

      group.on('click', handleTap);
      group.on('tap', handleTap);
      this.konvaLayer.add(group);
    });
  }

  _addPcScaleEvent() {
    const stage = this.konvaStage;

    const minScale = 0.8; // Minimum zoom ratio
    const maxScale = 10; // Maximum zoom ratio
    const scaleBy = 1.02; // Scaling factor, adjustable according to needs

    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const delta = Math.sign(e.evt.deltaY);
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale
      };
      let newScale = delta > 0 ? oldScale * scaleBy : oldScale / scaleBy;

      // Restrict scaling within the specified range
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
      };

      stage.position(newPos);
      // Shrink back to the original position
      if (newScale <= 1) {
        stage.position({ x: 0, y: 0 });
      }
      stage.batchDraw();
    });
  }

  _addMobileScaleEvent() {
    const stage = this.konvaStage;
    const layer = this.konvaLayer;

    const minScale = 0.8; // Minimum zoom ratio
    const maxScale = 10; // Maximum zoom ratio

    let lastScale = 1; // Last Zoom Scale
    let initialDistance = 0; // Distance between initial touch points
    let initialScale = 1; // Initial scaling ratio
    let initialCenter = { x: 0, y: 0 }; // Initial touch center point position

    stage.on('touchstart', (e) => {
      const touches = e.evt.touches;

      // If there are two touch points
      if (touches.length === 2) {
        layer.draggable(false);
        const touch1 = touches[0];
        const touch2 = touches[1];

        // Calculate the distance between initial touch points
        initialDistance = getDistance(
          touch1.clientX,
          touch1.clientY,
          touch2.clientX,
          touch2.clientY
        );

        // Calculate the initial touch center point position
        initialCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };

        // Record the initial scaling ratio and the previous scaling ratio
        initialScale = stage.scaleX();
        lastScale = initialScale;
      }
    });

    stage.on('touchmove', (e) => {
      const touches = e.evt.touches;

      // If there are two touch points
      if (touches.length === 2) {
        const touch1 = touches[0];
        const touch2 = touches[1];

        // Calculate the distance between the current touch points
        const currentDistance = getDistance(
          touch1.clientX,
          touch1.clientY,
          touch2.clientX,
          touch2.clientY
        );

        // Calculate scaling changes
        const scaleChange = currentDistance / initialDistance;

        // Calculate the current zoom ratio
        let scale = initialScale * scaleChange;

        // Restrict scaling within the specified range
        scale = Math.max(minScale, Math.min(maxScale, scale));

        // Calculate the position of the zoom center point relative to the stage
        const center = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };

        // Calculate the position change of the scaling center point before and after scaling
        const dx = (center.x - stage.x()) * (1 - scaleChange);
        const dy = (center.y - stage.y()) * (1 - scaleChange);

        // Update the scaling and position of the stage
        stage.scale({ x: scale, y: scale });
        stage.position({
          x: center.x - (center.x - stage.x()) * (scale / lastScale),
          y: center.y - (center.y - stage.y()) * (scale / lastScale)
        });

        lastScale = scale;

        stage.batchDraw();
      }
    });
    stage.on('touchend', (e) => {
      layer.draggable(true);
    });

    // Calculate the distance between two points
    function getDistance(x1: number, y1: number, x2: number, y2: number) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  _loadImage(imgSrc: string) {
    this.imgSrc = imgSrc;
    return loadImage(this.imgSrc);
  }

  /**
   * handle image data
   *
   */
  _handleSegmentation() {
    const { categorys } = this.imageData;
    for (const category of categorys) {
      const { segmentation } = category;
      const splitedSegmentation = splitSegmentation(segmentation);
      category.fillColor = Konva.Util.getRandomColor();
      category.handledSegmentation = splitedSegmentation.map<THandledSegmentation>(
        (splitedSegmentation: any) => ({
          splitedSegmentation,
          isChecked: false
        })
      );
    }
  }

  /**
   * foreach segmentation
   * @param segmentationCall
   */
  _foreachSegmentation(
    segmentationCall: (
      handledSeg: THandledSegmentation,
      segs: number[],
      category: TImageCategorysData
    ) => void
  ) {
    const { categorys } = this.imageData;
    for (const category of categorys) {
      const { segmentation, handledSegmentation } = category;
      let i = 0;
      for (const handledSeg of handledSegmentation) {
        segmentationCall && segmentationCall(handledSeg, segmentation[i], category);
        i++;
      }
    }
  }
}
