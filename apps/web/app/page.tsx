'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Assignment {
  id: number;
  player: string;
  role: string;
  task: string;
}

interface StrategyData {
  assignments: Assignment[];
  mapImage: string | null;
  notes: string;
}

export default function AooStrategyPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('Tank');
  const [task, setTask] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditor, setIsEditor] = useState(false);
  const [editorPassword, setEditorPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);

  // Password
  const EDITOR_PASSWORD = 'carn-dum';

  // Load from Supabase on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('aoo_strategy')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading data:', error);
      }

      if (data) {
        setStrategyId(data.id);
        const strategyData = data.data as StrategyData;
        setAssignments(strategyData.assignments || []);
        setMapImage(strategyData.mapImage || null);
        setNotes(strategyData.notes || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  // Save to Supabase
  const saveData = async (updatedData: Partial<StrategyData>) => {
    const data: StrategyData = {
      assignments: updatedData.assignments ?? assignments,
      mapImage: updatedData.mapImage ?? mapImage,
      notes: updatedData.notes ?? notes,
    };

    try {
      if (strategyId) {
        // Update existing record
        const { error } = await supabase
          .from('aoo_strategy')
          .update({ data })
          .eq('id', strategyId);

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        console.log('Data saved successfully!');
      } else {
        // Insert new record
        const { data: newData, error } = await supabase
          .from('aoo_strategy')
          .insert([{ data }])
          .select()
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }
        if (newData) {
          setStrategyId(newData.id);
          console.log('Data saved successfully!');
        }
      }
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data. Please try again.');
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditor) {
      setShowPasswordPrompt(true);
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newMapImage = event.target?.result as string;
        setMapImage(newMapImage);
        saveData({ mapImage: newMapImage });
      };
      reader.readAsDataURL(file);
    }
  };

  const addAssignment = () => {
    if (!isEditor) {
      setShowPasswordPrompt(true);
      return;
    }

    if (!playerName.trim()) {
      alert('Please enter a player name');
      return;
    }

    const newAssignment: Assignment = {
      id: Date.now(),
      player: playerName.trim(),
      role,
      task: task.trim() || 'No specific task assigned',
    };

    const updatedAssignments = [...assignments, newAssignment];
    setAssignments(updatedAssignments);
    saveData({ assignments: updatedAssignments });

    setPlayerName('');
    setTask('');
  };

  const deleteAssignment = (id: number) => {
    if (!isEditor) {
      setShowPasswordPrompt(true);
      return;
    }

    const updatedAssignments = assignments.filter((a) => a.id !== id);
    setAssignments(updatedAssignments);
    saveData({ assignments: updatedAssignments });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isEditor) {
      setShowPasswordPrompt(true);
      e.preventDefault();
      return;
    }

    const newNotes = e.target.value;
    setNotes(newNotes);
  };

  const handleNotesBlur = () => {
    if (isEditor) {
      saveData({ notes });
    }
  };

  const handlePasswordSubmit = () => {
    console.log('Entered password:', editorPassword);
    console.log('Expected password:', EDITOR_PASSWORD);
    console.log('Match:', editorPassword === EDITOR_PASSWORD);

    if (editorPassword === EDITOR_PASSWORD) {
      setIsEditor(true);
      setShowPasswordPrompt(false);
      setEditorPassword('');
      alert('Editor mode enabled! You can now make changes.');
    } else {
      alert('Incorrect password');
      setEditorPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white flex items-center justify-center">
        <div className="text-2xl">Loading strategy data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 p-6 bg-black/30 backdrop-blur-md rounded-xl">
          <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">
            ⚔️ Ark of Osiris Strategy ⚔️
          </h1>
          <p className="text-xl text-blue-200">Battle Plan & Team Assignments</p>
          {!isEditor && (
            <button
              onClick={() => setShowPasswordPrompt(true)}
              className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg"
            >
              🔒 Enable Editor Mode
            </button>
          )}
          {isEditor && (
            <p className="mt-4 text-green-400 font-bold">✓ Editor Mode Active</p>
          )}
        </header>

        {/* Password Prompt Modal */}
        {showPasswordPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white text-gray-900 p-8 rounded-xl max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Enter Editor Password</h2>
              <input
                type="password"
                value={editorPassword}
                onChange={(e) => setEditorPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Password"
                className="w-full px-4 py-2 border rounded-lg mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Submit
                </button>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setEditorPassword('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Viewing is always allowed. Password required for editing.
              </p>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Map Section */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-yellow-400 border-b-2 border-yellow-400 pb-3">
              📍 Battle Map
            </h2>
            <div className="bg-white rounded-lg p-3">
              <div className="bg-gradient-to-br from-purple-500 to-purple-700 min-h-[500px] rounded-lg flex items-center justify-center overflow-hidden">
                {mapImage ? (
                  <img
                    src={mapImage}
                    alt="Strategy Map"
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <p className="text-white text-xl">
                    {isEditor ? 'Upload your strategy map below' : 'No map uploaded yet'}
                  </p>
                )}
              </div>
            </div>
            {isEditor && (
              <div className="mt-4">
                <label
                  htmlFor="mapUpload"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer transition-colors"
                >
                  📁 Upload Map Image
                </label>
                <input
                  id="mapUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleMapUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Assignments Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-yellow-400 border-b-2 border-yellow-400 pb-3">
              👥 Team Assignments
            </h2>

            {/* Add Assignment Form - Only shown in editor mode */}
            {isEditor && (
              <div className="space-y-3 mb-6">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player Name"
                  className="w-full px-4 py-2 rounded-lg border-none text-gray-900"
                  onKeyPress={(e) => e.key === 'Enter' && addAssignment()}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border-none text-gray-900"
                >
                  <option value="Tank">Tank</option>
                  <option value="Rally Leader">Rally Leader</option>
                  <option value="Scout">Scout</option>
                  <option value="Support">Support</option>
                  <option value="Flag Defender">Flag Defender</option>
                  <option value="Attacker">Attacker</option>
                </select>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Task/Position (e.g., 'Guard North Flag')"
                  className="w-full px-4 py-2 rounded-lg border-none text-gray-900"
                  onKeyPress={(e) => e.key === 'Enter' && addAssignment()}
                />
                <button
                  onClick={addAssignment}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  + Add Assignment
                </button>
              </div>
            )}

            {/* Assignments List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {assignments.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p>
                    {isEditor
                      ? 'No assignments yet. Add team members above!'
                      : 'No assignments have been created yet.'}
                  </p>
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="bg-white/15 p-4 rounded-lg border-l-4 border-yellow-400 hover:bg-white/20 transition-all hover:translate-x-1"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-lg text-yellow-400">
                        {assignment.player}
                      </span>
                      <span className="bg-yellow-400/30 px-3 py-1 rounded-full text-sm uppercase">
                        {assignment.role}
                      </span>
                    </div>
                    <div className="text-gray-200 mb-2">📋 {assignment.task}</div>
                    {isEditor && (
                      <button
                        onClick={() => deleteAssignment(assignment.id)}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Strategy Notes */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400 border-b-2 border-yellow-400 pb-3">
            📝 Strategy Notes
          </h2>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            onBlur={handleNotesBlur}
            placeholder={
              isEditor
                ? 'Add your overall battle strategy, timing, rally schedules, etc...'
                : 'Strategy notes will appear here...'
            }
            disabled={!isEditor}
            className="w-full min-h-[150px] px-4 py-3 rounded-lg border-none text-gray-900 resize-y disabled:bg-gray-200 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}