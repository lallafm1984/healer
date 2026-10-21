import unittest
import numpy as np
from combat_quality import prepare


class CombatQualityTests(unittest.TestCase):
    rate = 44100

    def signal(self, decay):
        t = np.arange(self.rate * 2) / self.rate
        x = .4 * np.sin(2 * np.pi * 800 * t) * np.exp(-decay * t)
        return np.stack([x, x], axis=1)

    def test_rejects_silence_and_nan(self):
        for x in [np.zeros((1000, 2)), np.full((1000, 2), np.nan)]:
            with self.assertRaises(ValueError):
                prepare(x, self.rate, .4)

    def test_short_transient_keeps_headroom_and_natural_tail(self):
        y, metrics, reasons = prepare(self.signal(35), self.rate, .4)
        self.assertEqual(reasons, [])
        self.assertLessEqual(metrics["peak_db"], -2.99)
        self.assertLess(len(y) / self.rate, .4)
        self.assertEqual(y[0], 0)
        self.assertEqual(y[-1], 0)

    def test_fade_does_not_hide_a_truncated_long_sound(self):
        _, _, reasons = prepare(self.signal(.5), self.rate, .4)
        self.assertIn("unfinished loud tail", reasons)

    def test_rejects_a_loud_click_masking_a_very_weak_event(self):
        x = self.signal(5) * .01
        x[int(self.rate * .7)] = .9
        _, _, reasons = prepare(x, self.rate, 1)
        self.assertTrue(reasons)

    def test_selects_the_main_event_after_a_small_leading_click(self):
        x = np.zeros((self.rate * 2, 2))
        x[int(self.rate * .01)] = .3
        body = self.signal(35)[:int(self.rate * .4)]
        x[int(self.rate * .5):int(self.rate * .5) + len(body)] = body
        _, metrics, reasons = prepare(x, self.rate, .4)
        self.assertGreater(metrics["onset_seconds"], .48)
        self.assertLess(metrics["seconds"], .4)
        self.assertEqual(reasons, [])

    def test_multi_note_phrase_preserves_the_pause_and_second_note(self):
        x = np.zeros((self.rate * 2, 2))
        body = self.signal(45)[:int(self.rate * .2)]
        x[:len(body)] = body
        start = int(self.rate * .35)
        x[start:start+len(body)] = body * .8
        single, _, _ = prepare(x, self.rate, .8)
        phrase, metrics, reasons = prepare(x, self.rate, .8, event_gap=.3)
        self.assertLess(len(single) / self.rate, .3)
        self.assertGreater(metrics['seconds'], .4)
        self.assertGreater(np.max(abs(phrase[start:start+1000])), .01)
        self.assertEqual(reasons, [])


if __name__ == "__main__":
    unittest.main()
