// Questions API - stores questions asked to users
export interface Question {
    id: string;
    storyId: string;
    questionPrompt: string; // The original question prompt (e.g., "Ask me anything")
    creatorHandle: string; // The story creator who posted the question
    responderUserId: string;
    responderHandle: string;
    answer: string; // The answer/question text from the responder
    createdAt: number;
    repliedTo: boolean; // Whether the creator has replied to this question
    replyStoryId?: string; // Story ID if creator replied
}

// In-memory storage for questions (in production, this would be in a database)
const questions: Question[] = [];

// Get all questions for a user (creator)
export async function getQuestionsForUser(userHandle: string): Promise<Question[]> {
    await delay();
    
    // Find all questions where the story creator matches the user
    const userQuestions = questions.filter(q => {
        // We need to find questions by checking the story's userHandle
        // For now, we'll store the creator handle in the question
        return q.creatorHandle === userHandle && !q.repliedTo;
    });
    
    return userQuestions.sort((a, b) => b.createdAt - a.createdAt); // Newest first
}

// Add a question (when someone answers a question story)
export async function addQuestion(
    storyId: string,
    questionPrompt: string,
    creatorHandle: string,
    responderUserId: string,
    responderHandle: string,
    answer: string
): Promise<Question> {
    await delay();
    
    const question: Question = {
        id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        storyId,
        questionPrompt,
        creatorHandle,
        responderUserId,
        responderHandle,
        answer,
        createdAt: Date.now(),
        repliedTo: false
    };
    
    questions.push(question);
    return question;
}

// Mark question as replied to
export async function markQuestionReplied(questionId: string, replyStoryId: string): Promise<void> {
    await delay();
    
    const question = questions.find(q => q.id === questionId);
    if (question) {
        question.repliedTo = true;
        question.replyStoryId = replyStoryId;
    }
}

// Helper delay function
function delay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
