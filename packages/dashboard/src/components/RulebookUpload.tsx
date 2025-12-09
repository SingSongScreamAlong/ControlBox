import React, { useState, useCallback } from 'react';
import './RulebookUpload.css';

interface RulebookUploadProps {
    rulebookId: string;
    onUploadComplete: (sessionId: string) => void;
}

export const RulebookUpload: React.FC<RulebookUploadProps> = ({
    rulebookId,
    onUploadComplete
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discipline, setDiscipline] = useState<string>('general');

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate file type
        const validTypes = ['text/plain', 'text/markdown', 'application/pdf'];
        const validExtensions = ['.txt', '.md', '.pdf'];
        const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

        if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
            setError('Please upload a .txt, .md, or .pdf file');
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('File size must be under 5MB');
            return;
        }

        setFile(selectedFile);
        setError(null);

        // Extract text from file
        try {
            if (extension === '.pdf') {
                setExtractedText('PDF text extraction coming soon. Please paste the text directly.');
            } else {
                const text = await selectedFile.text();
                setExtractedText(text);
            }
        } catch (err) {
            setError('Failed to read file');
        }
    }, []);

    const handleSubmit = async () => {
        if (!extractedText.trim()) {
            setError('No text to interpret');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/rulebooks/${rulebookId}/interpret`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                    },
                    body: JSON.stringify({
                        rawText: extractedText,
                        fileName: file?.name,
                        discipline
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Upload failed');
            }

            onUploadComplete(data.data.sessionId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="rulebook-upload">
            <div className="upload-header">
                <h2>Upload Rulebook</h2>
                <p>Upload a text or markdown file containing your league rules. Our AI will extract and structure them for you.</p>
            </div>

            <div className="upload-section">
                <div className="file-input-container">
                    <input
                        type="file"
                        id="rulebook-file"
                        accept=".txt,.md,.pdf"
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                    <label htmlFor="rulebook-file" className="file-label">
                        <span className="upload-icon">📄</span>
                        {file ? file.name : 'Choose file or drag & drop'}
                    </label>
                </div>

                <div className="discipline-select">
                    <label htmlFor="discipline">Racing Discipline:</label>
                    <select
                        id="discipline"
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        disabled={isUploading}
                    >
                        <option value="general">General</option>
                        <option value="oval">Oval Racing</option>
                        <option value="road">Road Course</option>
                        <option value="endurance">Endurance</option>
                        <option value="dirt_oval">Dirt Oval</option>
                        <option value="dirt_road">Dirt Road / Rally</option>
                        <option value="open_wheel">Open Wheel</option>
                    </select>
                </div>
            </div>

            {extractedText && (
                <div className="text-preview">
                    <h3>Preview ({extractedText.length.toLocaleString()} characters)</h3>
                    <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        placeholder="Paste your rulebook text here..."
                        rows={12}
                        disabled={isUploading}
                    />
                </div>
            )}

            {!extractedText && !file && (
                <div className="paste-section">
                    <h3>Or paste text directly:</h3>
                    <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        placeholder="Paste your rulebook text here..."
                        rows={12}
                        disabled={isUploading}
                    />
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="upload-actions">
                <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={isUploading || !extractedText.trim()}
                >
                    {isUploading ? (
                        <>
                            <span className="spinner"></span>
                            Analyzing with AI...
                        </>
                    ) : (
                        <>
                            <span>🤖</span>
                            Interpret with GPT-5
                        </>
                    )}
                </button>
            </div>

            <div className="upload-tips">
                <h4>Tips for best results:</h4>
                <ul>
                    <li>Include rule numbers/references (e.g., "3.2.1" or "Article 5")</li>
                    <li>Clearly state penalties for each violation</li>
                    <li>Separate rules with blank lines or clear headers</li>
                    <li>Include any exceptions or special cases</li>
                </ul>
            </div>
        </div>
    );
};
