import fitz  # PyMuPDF
import io
import os
from PIL import Image

def extract_and_sort_assets(pdf_path, base_output_dir="fruzaqla_visual_aid_assets"):
    """
    Extracts images from a PDF, filters out artifacts, and sorts them into subfolders by file type.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return

    extracted_count = 0
    print(f"Scanning {pdf_path} for assets...")

    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        for img_index, img in enumerate(images):
            xref = img[0] 
            
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"].lower()

            try:
                image = Image.open(io.BytesIO(image_bytes))
                
                # Filter: Skip images smaller than 50x50 pixels
                if image.width < 50 or image.height < 50:
                    continue
                
                type_dir = os.path.join(base_output_dir, image_ext)
                os.makedirs(type_dir, exist_ok=True)

                image_name = f"page_{page_num + 1}_asset_{img_index + 1}.{image_ext}"
                image_path = os.path.join(type_dir, image_name)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                    
                extracted_count += 1
                
            except Exception as e:
                print(f"Skipped image {img_index} on page {page_num + 1}: {e}")

    print(f"\nExtraction complete! Successfully ripped and sorted {extracted_count} assets into '{base_output_dir}'.")

if __name__ == "__main__":
    # ONLY THIS LINE CHANGED
    target_pdf = "FRUZAQLA Visual Aid - Solstice.pdf" 
    extract_and_sort_assets(target_pdf)