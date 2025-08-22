import { router } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp, Mail } from "lucide-react-native";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { chooseReadableText } from "@/theme/color-utils";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "How do I transfer money to another account?",
    answer:
      'To transfer money, go to the Home screen and tap "Transfer". Select your card, choose a recipient, enter the amount, and confirm the transfer.',
  },
  {
    id: "2",
    question: "Is my money safe with this app?",
    answer:
      "Yes, we use bank-level security with 256-bit encryption. Your funds are FDIC insured up to $250,000 and we never store your sensitive information.",
  },
  {
    id: "3",
    question: "How do I add a new card to my account?",
    answer:
      "Currently, new cards are added through our customer service. Please contact support@yourbankapp.com to add additional cards to your account.",
  },
  {
    id: "4",
    question: "What should I do if I notice unauthorized transactions?",
    answer:
      "Immediately contact our support team at support@yourbankapp.com or call our 24/7 fraud hotline. We will freeze your account and investigate the transactions.",
  },
  {
    id: "5",
    question: "How do I change my PIN or password?",
    answer:
      "You can change your password in the Profile > Settings section. For PIN changes, please contact customer support for security verification.",
  },
];

export default function HelpSupportScreen() {
  const { colors } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleEmailSupport = () => {
    Linking.openURL(
      "mailto:support@yourbankapp.com?subject=Banking App Support"
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.card }]}
        >
          <ArrowLeft color={colors.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.contactSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>Need immediate help?</Text>
          <Pressable
            onPress={handleEmailSupport}
            style={({ pressed }) => [
              styles.emailButton,
              { backgroundColor: pressed ? colors.tintPrimary : colors.tintSoftBg },
            ]}
            android_ripple={{ color: colors.tintPrimary }}
          >
            {({ pressed }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Mail color={pressed ? chooseReadableText(colors.tintPrimary) : colors.tintPrimary} size={20} />
                <Text style={[
                  styles.emailText,
                  { color: pressed ? chooseReadableText(colors.tintPrimary) : colors.tintPrimary },
                ]}>
                  support@yourbankapp.com
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={[styles.faqSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Frequently Asked Questions</Text>

          {faqs.map((faq) => (
            <View key={faq.id} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(faq.id)}
              >
                <Text style={[styles.questionText, { color: colors.textPrimary }]}>{faq.question}</Text>
                {expandedFAQ === faq.id ? (
                  <ChevronUp color={colors.textSecondary} size={20} />
                ) : (
                  <ChevronDown color={colors.textSecondary} size={20} />
                )}
              </TouchableOpacity>

              {expandedFAQ === faq.id && (
                <View style={[styles.faqAnswer, { borderTopColor: colors.border }]}>
                  <Text style={[styles.answerText, { color: colors.textSecondary }]}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  faqSection: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  faqItem: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  faqQuestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questionText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
