<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { indiaStates, type IndiaStateData } from '$lib/data/countryData';
  import { overlayMetric } from '$lib/stores/indiaGeoStore';
  import { METRIC_CONFIGS } from '$lib/data/indiaConstants';
  import { get } from 'svelte/store';

  let { visible = false }: { visible?: boolean } = $props();

  // State centroids (approximate lat/lng → 3D position mapping)
  const stateCentroids: Record<string, { x: number; z: number }> = {
    'Maharashtra': { x: -1.5, z: 0.5 },
    'Uttar Pradesh': { x: 0.5, z: -2 },
    'Tamil Nadu': { x: -0.5, z: 3 },
    'Karnataka': { x: -1.5, z: 2 },
    'Gujarat': { x: -3, z: -0.5 },
    'Rajasthan': { x: -2, z: -2 },
    'West Bengal': { x: 2.5, z: 0 },
    'Madhya Pradesh': { x: -0.5, z: -0.5 },
    'Kerala': { x: -1, z: 3.5 },
    'Telangana': { x: -0.5, z: 1.5 },
    'Andhra Pradesh': { x: 0, z: 2 },
    'Punjab': { x: -1, z: -3 },
    'Bihar': { x: 2, z: -1.5 },
    'Delhi NCT': { x: -0.5, z: -2.5 },
  };

  const metric = $derived($overlayMetric);

  // Normalize state values to 0–1 for bar heights
  function getBarData(): Array<{ state: IndiaStateData; x: number; z: number; height: number; color: string }> {
    const config = METRIC_CONFIGS[metric];
    return indiaStates
      .filter(s => stateCentroids[s.name])
      .map(s => {
        const val = s[metric] as number;
        const ratio = Math.max(0, Math.min(1, (val - config.min) / (config.max - config.min)));
        const height = 0.2 + ratio * 4; // 0.2 to 4.2 units tall
        const pos = stateCentroids[s.name];
        return {
          state: s,
          x: pos.x,
          z: pos.z,
          height,
          color: config.colors[ratio < 0.5 ? 0 : ratio < 0.8 ? 1 : 2],
        };
      });
  }

  const bars = $derived(getBarData());
</script>

{#if visible}
  <div class="threed-overlay">
    <div class="threed-label">3D {METRIC_CONFIGS[metric].label} Visualization</div>
    <div class="threed-canvas">
      <Canvas>
        <T.PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50}>
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={5}
            maxDistance={20}
          />
        </T.PerspectiveCamera>

        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[5, 10, 5]} intensity={0.8} castShadow />

        <!-- Ground plane -->
        <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
          <T.PlaneGeometry args={[12, 12]} />
          <T.MeshStandardMaterial color="#0a0a1a" transparent opacity={0.6} />
        </T.Mesh>

        <!-- Grid -->
        <T.GridHelper args={[12, 12, '#1a1a3e', '#1a1a3e']} />

        <!-- Data bars -->
        {#each bars as bar}
          <T.Mesh
            position.x={bar.x}
            position.y={bar.height / 2}
            position.z={bar.z}
            castShadow
          >
            <T.BoxGeometry args={[0.4, bar.height, 0.4]} />
            <T.MeshStandardMaterial
              color={bar.color}
              metalness={0.3}
              roughness={0.4}
            />
          </T.Mesh>
          <!-- Label -->
          <T.Mesh position.x={bar.x} position.y={bar.height + 0.3} position.z={bar.z}>
            <T.SphereGeometry args={[0.08]} />
            <T.MeshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </T.Mesh>
        {/each}
      </Canvas>
    </div>
  </div>
{/if}

<style>
  .threed-overlay {
    position: fixed;
    bottom: 36px;
    right: 60px;
    width: 340px;
    height: 280px;
    z-index: var(--z-panel, 100);
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .threed-label {
    padding: 6px 10px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-family: var(--font-mono);
  }

  .threed-canvas {
    width: 100%;
    height: calc(100% - 28px);
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
