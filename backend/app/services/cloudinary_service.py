import cloudinary
import cloudinary.uploader
import cloudinary.api
from fastapi import UploadFile
import uuid

from app.config import get_settings

settings = get_settings()

# Initialize Cloudinary Configuration
cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True
)

async def upload_file(file: UploadFile, folder: str) -> str:
    """
    Upload a file buffer stream to Cloudinary dynamically and return the CDN URL.
    """
    try:
        # Generate entirely randomized public designation for unique caching rules
        random_id = str(uuid.uuid4())
        
        try:
            # Dispatch stream upload against Cloudinary CDN
            # We pass file.file (the SpooledTemporaryFile) rather than raw bytes
            response = cloudinary.uploader.upload(
                file.file,
                folder=folder,
                public_id=random_id,
                resource_type="auto" # Dynamically handles images, raw audio, and raw video types
            )
        except Exception as e:
            print(f"Cloudinary upload 'auto' failed ({str(e)}). Retrying with 'raw'.")
            # Reset the file stream before trying again
            await file.seek(0)
            response = cloudinary.uploader.upload(
                file.file,
                folder=folder,
                public_id=random_id,
                resource_type="raw" # Explicit raw fallback for .docx, .webm, .csv, etc
            )
        
        # Return secure SSL resolution URL
        return response.get("secure_url")
        
    except Exception as e:
        print(f"Cloudinary verification fault -> {str(e)}")
        raise e
    finally:
        # Crucial to reset file seek otherwise subsequent functions (or validations) reading the buffer hit EOF natively
        await file.seek(0)
