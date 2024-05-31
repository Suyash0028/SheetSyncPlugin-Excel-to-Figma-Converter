// Define your plugin command and entry point
figma.showUI(__html__, { width: 320, height: 600 });

// Function to update the frame count
function updateFrameCount() {
  const selectedFrames = figma.currentPage.selection.filter(node => node.type === 'FRAME');
  const count = selectedFrames.length;
  figma.ui.postMessage({ type: 'update-count', count: count });
}

// Initial update of the frame count when the plugin starts
updateFrameCount();

// Listen for selection changes
figma.on('selectionchange', () => {
  updateFrameCount();
});

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'get-count':
      updateFrameCount();
      break;
    case 'error':
      figma.notify(msg.message, {
        timeout: 1000,
        error: true
      });
      break;
    case 'populate-template':
      const data = msg.data;
      const columnNames = data[0];

      const selectedFrames = figma.currentPage.selection.filter(node => node.type === "FRAME") as FrameNode[];
      for (const frame of selectedFrames) {
        for (let i = 1; i < data.length; i++) {
          const rowData = data[i];

          for (let j = 0; j < rowData.length; j++) {
            const item = rowData[j];
            const columnName = columnNames[j];

            const textNode = frame.findOne(node => node.name === `${columnName}` && node.type === "TEXT") as TextNode;
            const imageNode = frame.findOne(node => node.name === `${columnName}` && (node.type === "FRAME" || node.type === "RECTANGLE")) as FrameNode | RectangleNode;

            if (textNode) {
              await setTextAsync(textNode, item);
            } else if (imageNode) {
              loadImageAndSetImage(imageNode, item);
            } else {
              figma.notify('Few columns not found in the frame.', {
                timeout: 1000,
                error: true
              });
              break;
            }
          }
        }
      }
      break;
    case 'check-selection':
      updateFrameCount();
      break;
    default:
      break;
  }
};

async function setTextAsync(textNode: TextNode, text: string) {
  try {
    await figma.loadFontAsync(textNode.fontName as FontName);
    textNode.characters = text;
  } catch (error) {
    figma.notify(`Error setting text:${error}`, {
      timeout: 1000,
      error: true
    });
  }
}

function loadImageAndSetImage(node: FrameNode | RectangleNode, imageUrl: string) {

  // Create the image from the URL
  figma.createImageAsync(imageUrl).then((image) => {
    // Get the dimensions of the image
    image.getSizeAsync().then(({ width: imageWidth, height: imageHeight }) => {

      // Get the dimensions of the frame
      const nodeWidth = node.width;
      const nodeHeight = node.height;
  
      
      // Calculate the scaling factors to fit the image within the frame
      const widthScale = nodeWidth / imageWidth;
      const heightScale = nodeHeight / imageHeight;
      const scale = Math.min(widthScale, heightScale);

      // Calculate the scaled dimensions of the image
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;

      // Create a rectangle node and resize it to match the scaled image dimensions
      if (node.type === 'RECTANGLE') {
        node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
        console.log('Image set as fill for RECTANGLE node:', node);
      } else if (node.type === 'FRAME') {
        const imageNode = figma.createRectangle();
        imageNode.resize(scaledWidth, scaledHeight);
        imageNode.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
        imageNode.x = (nodeWidth - scaledWidth) / 2;
        imageNode.y = (nodeHeight - scaledHeight) / 2;
  
        node.children.forEach(child => {
          if (child.type === 'RECTANGLE') {
            child.remove();
          }
        });
  
        node.appendChild(imageNode);
        console.log('Image set as child for FRAME node:', node);
      }
    }).catch(error => {
      figma.notify(`Error getting image size: ${error}`, {
        timeout: 1000,
        error: true
      });
    });


  }).catch((error) => {
    figma.notify(error, {
      timeout: 1000,
      error: true
    });
  });
}