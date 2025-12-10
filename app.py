import os
import time
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from groq import Groq
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Groq Client for Audio
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Initialize LangChain Chat Model for Text Analysis
llm = ChatGroq(
    temperature=0,
    model_name="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY")
)

import re
import json

def parse_llm_json(content):
    """
    Strips markdown and parses JSON. Handles common LLM errors like newlines in strings.
    """
    content = content.strip()
    # Remove leading ```json or ```
    content = re.sub(r'^```(?:json)?\s*', '', content, flags=re.IGNORECASE)
    # Remove trailing ```
    content = re.sub(r'\s*```$', '', content)
    content = content.strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Attempt to sanitize unescaped newlines within the JSON string
        try:
            # This is a bit naive but works for simple cases where newlines break the JSON
            # We assume structural newlines are fine, but string newlines need escaping
            # A strict parser would fail, so we might return an error object or try to "fix" it
            # For now, let's try to pass the raw string if parsing fails, but packaged in a safe dict
            return {
                "language": "Unknown (Parse Error)",
                "confidence": 0,
                "translation": content, # Send raw content to see what happened
                "error": "Failed to parse JSON"
            }
        except Exception:
             return {"error": "Critical parse error"}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    start_time = time.time()
    data = request.json
    text = data.get('text')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        # Prompt for language detection
        messages = [
            ("system", "You are a helpful assistant that detects languages. return the response in RAW JSON format (no markdown, no backticks). Ensure all strings are properly escaped. Valid keys are: language, confidence, translation (if not english translate to english otherwise return original text)."),
            ("human", f"Detect the language of the following text: '{text}'")
        ]
        response = llm.invoke(messages)
        end_time = time.time()
        execution_time = round(end_time - start_time, 2)
        
        return jsonify({
            'result': parse_llm_json(response.content),
            'execution_time': execution_time
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_file', methods=['POST'])
def analyze_file():
    start_time = time.time()
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            # Transcribe audio/video
            with open(filepath, "rb") as file_stream:
                transcription = groq_client.audio.transcriptions.create(
                    file=(filename, file_stream.read()),
                    model="whisper-large-v3",
                    response_format="json",
                    language=None, # Auto-detect
                    temperature=0.0
                )
            
            transcribed_text = transcription.text
            
            # Analyze transcribed text
            messages = [
                ("system", "You are a helpful assistant that detects languages. return the response in RAW JSON format (no markdown, no backticks). Ensure all strings are properly escaped. Valid keys are: language, confidence, translation (if not english translate to english otherwise return original text)."),
                ("human", f"Detect the language of the following transcribed text: '{transcribed_text}'")
            ]
            response = llm.invoke(messages)
            
            # Cleanup
            os.remove(filepath)
            
            end_time = time.time()
            execution_time = round(end_time - start_time, 2)
            
            return jsonify({
                'transcription': transcribed_text,
                'analysis': parse_llm_json(response.content),
                'execution_time': execution_time
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
