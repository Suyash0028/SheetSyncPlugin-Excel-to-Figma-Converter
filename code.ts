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
    if (msg.type === 'get-count') {
        updateFrameCount();
    }
    else if (msg.type === 'error') {
      figma.notify(msg.message,{
        timeout:1000,
        error: true
      });
      figma.ui.postMessage({ type: 'errorAcknowledged' });
    }
    if (msg.type === 'populate-template') {
      const data = msg.data;
      console.log(data);
      const columnNames = data[0]; 
      
      const selectedFrames = figma.currentPage.selection.filter(node => node.type === "FRAME") as FrameNode[];
  
      for (const frame of selectedFrames) {
        for (let i = 1; i < data.length; i++) {
          const rowData = data[i];
  
          for (let j = 0; j < rowData.length; j++) {
            const item = rowData[j];
            const columnName = columnNames[j]; 
  
            const textNode = frame.findOne(node => node.name === `${columnName}` && node.type === "TEXT") as TextNode;
            const imageFrame = frame.findOne(node => node.name === `${columnName}` && node.type === "FRAME") as FrameNode;
  
            if (textNode) {
              await setTextAsync(textNode, item);
            } else if (imageFrame) {
              loadImageAndSetImage(imageFrame, item);
            } else {
              figma.notify(`No matching node found for column: ${columnName}`,{
                timeout:1000,
                error: true
              });
            }
          }
        }
      }
    } else if (msg.type === 'check-selection') {
      updateFrameCount();
    }
};

async function setTextAsync(textNode: TextNode, text: string) {
  try {
    await figma.loadFontAsync(textNode.fontName as FontName);
    textNode.characters = text;
  } catch (error) {
    console.error('Error setting text:', error);
  }
}

function loadImageAndSetImage(frame: FrameNode, imageUrl: string) {
  try {
    // Create the image from the URL
    figma.createImageAsync(imageUrl).then((image)=>{
      // Get the dimensions of the image
      image.getSizeAsync().then(({ width: imageWidth, height: imageHeight }) => {
        // Check if the image exceeds Figma's maximum allowable dimensions
    const MAX_DIMENSION = 4000;
    if (imageWidth > MAX_DIMENSION || imageHeight > MAX_DIMENSION) {
      throw new Error('Image is too large to be processed by Figma.');
    }

    // Get the dimensions of the frame
    const frameWidth = frame.width;
    const frameHeight = frame.height;

    // Calculate the scaling factors to fit the image within the frame
    const widthScale = frameWidth / imageWidth;
    const heightScale = frameHeight / imageHeight;
    const scale = Math.min(widthScale, heightScale);

    // Calculate the scaled dimensions of the image
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;
    console.log(scaledWidth, scaledHeight)
    // Create a rectangle node and resize it to match the scaled image dimensions
    const imageNode = figma.createRectangle();
    imageNode.resize(scaledWidth, scaledHeight);

    // Set the image as the fill of the rectangle node
    imageNode.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];

    // Position the image node in the center of the frame
    imageNode.x = (frameWidth - scaledWidth) / 2;
    imageNode.y = (frameHeight - scaledHeight) / 2;

    // Remove existing rectangle nodes from the frame
    frame.children.forEach(child => {
      if (child.type === 'RECTANGLE') {
        child.remove();
      }
    });

    // Append the rectangle node to the frame
    frame.appendChild(imageNode);
      }).catch(error => {
        console.error('Error getting image size:', error);
      });
    

    }).catch((error)=>{
      figma.notify(error, {
        timeout:1000,
        error: true
      });
    });
    
  } catch (error) {
    console.error('Error loading image:', error);
  }
}