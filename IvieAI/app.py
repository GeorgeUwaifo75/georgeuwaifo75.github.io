from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Hugging Face configuration
MODEL_ENDPOINT = "https://api-inference.huggingface.co/models/GeorgeUwaifo/ivie_gpt2_new01_results"
HF_API_TOKEN = os.getenv('HF_API_TOKEN', 'YOUR_HF_API_TOKEN_HERE')

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat requests and return AI responses"""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'error': 'Please enter a message'}), 400
        
        # Prepare the payload for Hugging Face API
        payload = {
            "inputs": user_message,
            "parameters": {
                "max_new_tokens": 150,
                "temperature": 0.85,
                "top_p": 0.9,
                "do_sample": True,
                "return_full_text": False,
                "repetition_penalty": 1.1
            },
            "options": {
                "wait_for_model": True,
                "use_cache": False
            }
        }
        
        # Make request to Hugging Face API
        headers = {
            'Authorization': f'Bearer {HF_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(
            MODEL_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        # Handle API errors
        if response.status_code == 401:
            return jsonify({'error': 'Invalid API token. Please check your Hugging Face token.'}), 401
        elif response.status_code == 503:
            return jsonify({'error': 'Model is loading. Please wait a moment and try again.'}), 503
        elif response.status_code != 200:
            error_msg = f'API Error: {response.status_code}'
            try:
                error_data = response.json()
                error_msg = error_data.get('error', error_msg)
            except:
                pass
            return jsonify({'error': error_msg}), response.status_code
        
        # Parse the response
        result = response.json()
        
        # Extract generated text
        ai_response = ""
        if isinstance(result, list) and len(result) > 0:
            ai_response = result[0].get('generated_text', '').strip()
        elif isinstance(result, dict) and 'generated_text' in result:
            ai_response = result['generated_text'].strip()
        else:
            ai_response = "I'm here to chat! Could you rephrase that?"
        
        # Fallback for empty responses
        if not ai_response:
            ai_response = "That's interesting! Tell me more about that."
        
        return jsonify({'response': ai_response})
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out. The model might be busy. Please try again.'}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Connection error. Please check your internet connection.'}), 503
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
