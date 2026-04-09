import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import UniversesPage from './pages/UniversesPage';
import UniversesPageClassic from './pages/UniversesPageClassic';
import UniverseDetailPage from './pages/UniverseDetailPage';
import CharactersPage from './pages/CharactersPage';
import LocationsPage from './pages/LocationsPage';
import ChaptersPage from './pages/ChaptersPage';
import NotesPage from './pages/NotesPage';
import DraftsPage from './pages/DraftsPage';
import QuotesPage from './pages/QuotesPage';
import ChatPage from './pages/ChatPage';
import GraphPage from './pages/GraphPage';
import TimelinePage from './pages/TimelinePage';
import SearchPage from './pages/SearchPage';
import OutlinePage from './pages/OutlinePage';
import DevelopUniversePage from './pages/DevelopUniversePage';
import WriteBookWizardPage from './pages/WriteBookWizardPage';
import WritePage from './pages/WritePage';
import BookEditorPage from './pages/BookEditorPage';
import UniverseViewPage from './pages/UniverseViewPage';
import BookSettingsPage from './pages/BookSettingsPage';
import SettingsPage from './pages/SettingsPage';
import WikiPage from './pages/WikiPage';
import ConceptArtPage from './pages/ConceptArtPage';
import SpacePage from './pages/SpacePage';
import FactionsPage from './pages/FactionsPage';
import TechnologiesPage from './pages/TechnologiesPage';
import CharacterKnowledgePage from './pages/CharacterKnowledgePage';
import CoveragePage from './pages/CoveragePage';
import StorylinesPage from './pages/StorylinesPage';

function UniversesRedirect() {
  const { universeId } = useParams();
  return <Navigate to={`/universes/${universeId}`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/universes" replace />} />
        <Route path="books/:universeId" element={<UniversesRedirect />} />
        <Route path="universes" element={<UniversesPage />} />
        <Route path="universes/classic" element={<UniversesPageClassic />} />
        {/* Глобальные настройки приложения (системные) */}
        <Route path="settings" element={<SettingsPage />} />
          <Route path="universes/:universeId" element={<UniverseDetailPage />}>
          <Route index element={<Navigate to={`characters`} replace />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/:characterId" element={<CharactersPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="chapters" element={<ChaptersPage />} />
          <Route path="storylines" element={<StorylinesPage />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="outline" element={<OutlinePage />} />
          <Route path="develop" element={<DevelopUniversePage />} />
          <Route path="write-book" element={<WriteBookWizardPage />} />
          <Route path="write" element={<WritePage />} />
          <Route path="book" element={<BookEditorPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/:noteId" element={<NotesPage />} />
          <Route path="drafts" element={<DraftsPage />} />
          <Route path="drafts/:draftId" element={<DraftsPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="factions" element={<FactionsPage />} />
          <Route path="technologies" element={<TechnologiesPage />} />
          <Route path="wiki" element={<WikiPage />} />
          <Route path="concept-art" element={<ConceptArtPage />} />
          <Route path="space" element={<SpacePage />} />
          <Route path="knowledge" element={<CharacterKnowledgePage />} />
          <Route path="graph" element={<GraphPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="book-view" element={<UniverseViewPage />} />
          {/* Настройки вселенной / книги (в контексте выбранной вселенной) */}
          <Route path="settings" element={<BookSettingsPage />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
