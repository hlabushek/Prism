import re
import base64
import os
import shutil

svg_path = r"C:\Users\JetGame\Desktop\лого Prism News.svg"
out_dir = r"c:\Users\JetGame\Prism\frontend\public"
os.makedirs(out_dir, exist_ok=True)

# Copy original SVG to public assets
svg_dest = os.path.join(out_dir, "logo.svg")
shutil.copyfile(svg_path, svg_dest)
print(f"Copied {svg_path} to {svg_dest}")

with open(svg_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("SVG character length:", len(content))

# Extract base64 image if present
match = re.search(r'xlink:href=["\']data:image/([^;]+);base64,([^"\']+)["\']', content)
if match:
    img_ext = match.group(1).replace("jpeg", "jpg")
    b64_data = match.group(2).replace("\n", "").replace("\r", "")
    out_img = os.path.join(out_dir, f"logo.{img_ext}")
    with open(out_img, "wb") as f:
        f.write(base64.b64decode(b64_data))
    print(f"Extracted raster logo image to {out_img} (format: {img_ext}, base64 len: {len(b64_data)})")
else:
    print("No base64 image embedded, checking SVG elements...")

# Let's also check image dimensions or properties with PIL if available
try:
    from PIL import Image
    for ext in ["jpg", "png", "svg"]:
        test_p = os.path.join(out_dir, f"logo.{ext}")
        if os.path.exists(test_p) and ext != "svg":
            with Image.open(test_p) as im:
                print(f"Image {test_p}: size={im.size}, mode={im.mode}")
                # Analyze dominant colors
                colors = im.getcolors(maxcolors=100000)
                # Sample colors
                print("Color profile / thumbnail analyzed.")
except Exception as e:
    print("PIL analysis:", e)
