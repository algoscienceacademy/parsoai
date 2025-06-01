import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI('AIzaSyCZtgzvR07C-Dn67zie8QC_Rk2VZNsafiI');

export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      language, 
      isVoiceRequest, 
      conversationFlow, 
      screenSharing, 
      screenData,
      conversationContext
    } = await request.json();
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    let prompt = `You are ParsoAI, an advanced personal AI assistant with real-time screen analysis capabilities.

CONTEXT:
- Language: ${language === 'en' ? 'English' : 'Bengali'}
- Voice Request: ${isVoiceRequest ? 'Yes' : 'No'}
- Conversation Flow: ${conversationFlow}
- Screen Sharing: ${screenSharing ? 'Active' : 'Inactive'}
- User Speaking: ${conversationContext?.isUserSpeaking ? 'Yes' : 'No'}
- Waiting for User: ${conversationContext?.waitingForUser ? 'Yes' : 'No'}

`;

    if (screenSharing && screenData) {
      prompt += `SCREEN ANALYSIS:
- Screen Resolution: ${screenData.screenMetrics?.resolution || 'Unknown'}
- Analysis Status: ${screenData.analysisInProgress ? 'In Progress' : 'Completed'}
- Screenshot Available: ${screenData.screenshot ? 'Yes' : 'No'}

`;

      if (screenData.detectedCode) {
        prompt += `DETECTED CODE:
Language: ${screenData.detectedCode.language}
Confidence: ${Math.round(screenData.detectedCode.confidence * 100)}%
Complexity: ${screenData.detectedCode.analysis.complexity}

Code Content:
\`\`\`${screenData.detectedCode.language}
${screenData.detectedCode.content}
\`\`\`

Issues Found:
${screenData.detectedCode.analysis.issues.map((issue: string) => `- ${issue}`).join('\n')}

Suggestions:
${screenData.detectedCode.analysis.suggestions.map((suggestion: string) => `- ${suggestion}`).join('\n')}

`;
      }

      if (screenData.allDetectedCodes && screenData.allDetectedCodes.length > 1) {
        prompt += `ADDITIONAL CODE DETECTED: ${screenData.allDetectedCodes.length - 1} other code blocks found on screen.

`;
      }
    }

    prompt += `User Message: ${message}

RESPONSE GUIDELINES:
- You can see and analyze the user's screen in real-time when screen sharing is active
- If code is detected, provide specific analysis, suggestions, and explanations
- For voice requests, keep responses conversational and under 120 words
- Wait for the user to finish speaking before responding
- If screen sharing is active, acknowledge what you can see
- Be helpful with code debugging, explanation, and improvement suggestions
- For Bengali responses, use clear and natural language
- Don't talk continuously - wait for user input
- If you see code on screen, you can proactively comment on it when asked

CONVERSATION RULES:
- Only respond when the user has finished speaking or typing
- Don't initiate new conversations unless specifically asked
- If user is still speaking, wait for them to finish
- Acknowledge screen content when relevant to the conversation`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Determine emotion based on content
    let emotion = 'professional';
    if (text.includes('excellent') || text.includes('great') || text.includes('perfect')) {
      emotion = 'excited';
    } else if (text.includes('issue') || text.includes('problem') || text.includes('error')) {
      emotion = 'calm';
    }

    return NextResponse.json({ 
      response: text,
      emotion,
      success: true 
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json({ 
      error: 'AI service temporarily unavailable. Please try again.',
      success: false 
    }, { status: 500 });
  }
}
