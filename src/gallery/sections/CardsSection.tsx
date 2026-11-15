import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  HeroBackdrop,
  MovieCard,
  SearchResultRow,
  Skeleton,
  Text,
} from '../../components';
import { primitives } from '../../tokens/tokens';
import { GalleryGroup, GalleryItem } from '../GalleryParts';
import { MOCK_CINEMA, MOCK_META, MOCK_TITLES } from '../mocks';
import { MOCK_HERO_IMAGE, MOCK_POSTERS } from '../posterImages';

const noop = () => {};
const HERO_DEMO_HEIGHT = primitives['space/16'] * 5;
/** Not a valid image: the primary fails to load, so the fallback image shows. */
const BROKEN_IMAGE = 'data:image/png;base64,AAAA';

function CardRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {children}
    </ScrollView>
  );
}

export function CardsSection() {
  return (
    <>
      <GalleryGroup
        name="Card"
        note="A raised surface with a content slot. Light mode shows height with elevation/1; dark mode shows it with surface/raised and a hairline border. Put any content in the slot."
      >
        <GalleryItem label="cinema card: title and body">
          <Card title={MOCK_CINEMA.name} body={MOCK_CINEMA.showing} />
        </GalleryItem>
        <GalleryItem label="long title and body wrap">
          <Card title={MOCK_TITLES.long} body={MOCK_META.long} />
        </GalleryItem>
        <GalleryItem label="ticket row: a Badge and a note in the slot (a TicketCard composition)">
          <Card title={MOCK_TITLES.regular} body={`${MOCK_CINEMA.name} · Sat 14 Nov, 19:30`}>
            <View style={styles.slotRow}>
              <Badge tone="success" label="Confirmed" />
              <Text variant="caption" color="text/secondary">
                {MOCK_CINEMA.ticketNote}
              </Text>
            </View>
          </Card>
        </GalleryItem>
        <GalleryItem label="slot with an action">
          <Card title={MOCK_TITLES.short} body={MOCK_CINEMA.showing}>
            <Button variant="secondary" label="Show ticket" onPress={noop} />
          </Card>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="MovieCard"
        note="3 layouts. A missing or failed poster falls back to the title on a skeleton fill. Poster layouts are 128×192; list is a 64×96 thumb."
      >
        <GalleryItem label="poster: image, no poster (fallback), long title">
          <CardRow>
            <MovieCard layout="poster" title={MOCK_TITLES.regular} posterUrl={MOCK_POSTERS.red} onPress={noop} />
            <MovieCard layout="poster" title={MOCK_TITLES.short} posterUrl={null} onPress={noop} />
            <MovieCard layout="poster" title={MOCK_TITLES.long} posterUrl={null} onPress={noop} />
          </CardRow>
        </GalleryItem>

        <GalleryItem label="poster-title: title and meta under the poster, long title, no poster">
          <CardRow>
            <MovieCard
              layout="poster-title"
              title={MOCK_TITLES.regular}
              meta={MOCK_META.regular}
              posterUrl={MOCK_POSTERS.green}
              onPress={noop}
            />
            <MovieCard
              layout="poster-title"
              title={MOCK_TITLES.long}
              meta={MOCK_META.regular}
              posterUrl={MOCK_POSTERS.cream}
              onPress={noop}
            />
            <MovieCard
              layout="poster-title"
              title={MOCK_TITLES.short}
              meta={MOCK_META.year}
              posterUrl={null}
              onPress={noop}
            />
          </CardRow>
        </GalleryItem>

        <GalleryItem label="list: with meta, no poster, long title and meta">
          <View style={styles.stack}>
            <MovieCard
              layout="list"
              title={MOCK_TITLES.regular}
              meta={MOCK_META.regular}
              posterUrl={MOCK_POSTERS.dark}
              onPress={noop}
            />
            <MovieCard layout="list" title={MOCK_TITLES.short} meta={MOCK_META.year} posterUrl={null} onPress={noop} />
            <MovieCard
              layout="list"
              title={MOCK_TITLES.long}
              meta={MOCK_META.long}
              posterUrl={MOCK_POSTERS.red}
              onPress={noop}
            />
          </View>
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="SearchResultRow"
        note="Compact row for search and genre results: 64×96 thumb, title (label-lg), meta (body), at least 48 high."
      >
        <GalleryItem label="title and meta">
          <SearchResultRow
            title={MOCK_TITLES.regular}
            meta={`${MOCK_META.year} · A quiet journey.`}
            posterUrl={MOCK_POSTERS.green}
            onPress={noop}
          />
        </GalleryItem>
        <GalleryItem label="long title and long meta">
          <SearchResultRow
            title={MOCK_TITLES.long}
            meta={MOCK_META.long}
            posterUrl={MOCK_POSTERS.cream}
            onPress={noop}
          />
        </GalleryItem>
        <GalleryItem label="no poster (fallback)">
          <SearchResultRow title={MOCK_TITLES.short} meta={MOCK_META.year} posterUrl={null} onPress={noop} />
        </GalleryItem>
        <GalleryItem label="no meta">
          <SearchResultRow title={MOCK_TITLES.regular} posterUrl={MOCK_POSTERS.red} onPress={noop} />
        </GalleryItem>
      </GalleryGroup>

      <GalleryGroup
        name="HeroBackdrop"
        note="Full-width hero: progressive image with a skeleton placeholder, a fade to the page colour and a status-bar scrim. Children sit at the bottom. Shown at a fixed demo height."
      >
        <GalleryItem label="image loaded, with title, meta and action">
          <HeroBackdrop height={HERO_DEMO_HEIGHT} imageUrl={MOCK_HERO_IMAGE} accessibilityLabel={`${MOCK_TITLES.regular} poster`}>
            <Text variant="display" color="text/primary">
              {MOCK_TITLES.regular}
            </Text>
            <Text variant="body" color="text/secondary">
              {`${MOCK_META.regular} · Now playing`}
            </Text>
            <Button variant="primary" fullWidth label="See showtimes" onPress={noop} />
          </HeroBackdrop>
        </GalleryItem>

        <GalleryItem label="primary image fails, fallback image shows">
          <HeroBackdrop
            height={HERO_DEMO_HEIGHT}
            imageUrl={BROKEN_IMAGE}
            fallbackImageUrl={MOCK_POSTERS.red}
            accessibilityLabel={`${MOCK_TITLES.short} poster`}
          >
            <Text variant="display" color="text/primary">
              {MOCK_TITLES.short}
            </Text>
            <Text variant="body" color="text/secondary">
              {MOCK_META.year}
            </Text>
          </HeroBackdrop>
        </GalleryItem>

        <GalleryItem label="no image: skeleton placeholder">
          <HeroBackdrop height={HERO_DEMO_HEIGHT} imageUrl={null}>
            <Text variant="display" color="text/primary">
              {MOCK_TITLES.regular}
            </Text>
          </HeroBackdrop>
        </GalleryItem>

        <GalleryItem label="loading">
          <HeroBackdrop loading height={HERO_DEMO_HEIGHT}>
            <Skeleton shape="text" width={primitives['space/16'] * 4} height={primitives['space/6']} />
            <Skeleton shape="text" width={primitives['space/16'] * 3} height={primitives['space/4']} />
            <Skeleton shape="block" width="100%" height={primitives['size/touch-min']} />
          </HeroBackdrop>
        </GalleryItem>
      </GalleryGroup>
    </>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    gap: primitives['space/3'],
    alignItems: 'flex-start',
  },
  stack: {
    gap: primitives['space/3'],
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: primitives['space/3'],
  },
});
