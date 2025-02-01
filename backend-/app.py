from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import datefinder
from transformers import pipeline

# BART summarizer model 
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

app = FastAPI()

# allowing cors for React frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allowing frontend to communicate with backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# define the input structure
class TextInput(BaseModel):
    text: str

@app.post("/detect_date")
async def detect_date(input_data: TextInput):
    matches = list(datefinder.find_dates(input_data.text))  # extract dates from the input text

    if matches:
        result = []
        for match in matches:
            # find the context around the date 
            start_idx = max(input_data.text.find(str(match)) - 100, 0)
            end_idx = min(input_data.text.find(str(match)) + 100, len(input_data.text))

            context = input_data.text[start_idx:end_idx]
            
            # in case no context is found
            eventName = "Unknown Event"
            eventDescription = "No description available"

            if context:
                try:
                    # summarize the context around the date
                    eventName = summarizer(context, max_length=10, min_length=7, do_sample=False)[0]['summary_text']
                    eventDescription = summarizer(context, max_length=70, min_length=30, do_sample=False)[0]['summary_text']
                except Exception as e:
                    eventName = "Error summarizing event name"
                    eventDescription = "Error summarizing description"
            
            result.append({
                "date": str(match),
                "eventName": eventName,
                "eventDescription": eventDescription,
            })
        
        return {"events": result}
    else:
        return {"message": "No dates found"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
